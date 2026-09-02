-- Cashout partial fulfillment currently creates inventory rows before it updates the
-- cashout request. Track those returned rows by cashout + card index so repeated
-- admin fulfillment calls cannot duplicate returned cards, and so a card that was
-- returned (and later sold) cannot also be marked as shipped.

CREATE OR REPLACE FUNCTION prevent_cashout_return_duplication()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_ids jsonb := COALESCE(OLD.fulfilled_card_ids, '[]'::jsonb);
  new_ids jsonb := COALESCE(NEW.fulfilled_card_ids, '[]'::jsonb);
  idx integer;
  card jsonb;
  target_card_name text;
  target_card_id text;
  target_card_value numeric;
  target_card_rarity text;
  target_card_image text;
  target_card_pack text;
  returned_id text;
  candidate_id text;
  was_fulfilled boolean;
  is_fulfilled boolean;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.fulfilled_card_ids IS NULL THEN
    RETURN NEW;
  END IF;

  IF jsonb_array_length(COALESCE(NEW.cards_json::jsonb, '[]'::jsonb)) = 0 THEN
    RETURN NEW;
  END IF;

  FOR idx IN 0..jsonb_array_length(NEW.cards_json::jsonb) - 1 LOOP
    card := NEW.cards_json::jsonb -> idx;
    IF card IS NULL OR jsonb_typeof(card) <> 'object' THEN
      CONTINUE;
    END IF;

    target_card_name := COALESCE(card->>'card_name', card->>'cardName', 'Unknown Card');
    target_card_id := regexp_replace(lower(target_card_name), '[^a-z0-9]+', '-', 'g');
    target_card_value := COALESCE(NULLIF(card->>'value', '')::numeric, 0);
    target_card_rarity := COALESCE(card->>'rarity', 'common');
    target_card_image := COALESCE(card->>'card_image_url', card->>'cardImageUrl');
    target_card_pack := COALESCE(card->>'pack_name', card->>'packName');

    was_fulfilled := old_ids @> jsonb_build_array(idx);
    is_fulfilled := new_ids @> jsonb_build_array(idx);

    -- A newly-fulfilled card from an already-partial request was previously
    -- returned to inventory. It must still be there and unsold before shipping.
    IF OLD.status = 'partial' AND is_fulfilled AND NOT was_fulfilled THEN
      SELECT i.id INTO returned_id
      FROM inventory i
      WHERE i.user_id = NEW.user_id
        AND COALESCE(i.sold, 0) = 0
        AND i.data->>'cashout_return_id' = NEW.id
        AND i.data->>'cashout_return_index' = idx::text
      ORDER BY i.created_at DESC
      LIMIT 1;

      IF returned_id IS NULL THEN
        RAISE EXCEPTION 'Cashout card index % is no longer available in returned inventory', idx
          USING ERRCODE = 'P0001';
      END IF;

      DELETE FROM inventory WHERE id = returned_id;
      CONTINUE;
    END IF;

    -- Unfulfilled cards should have exactly one tagged returned-inventory row.
    IF NOT is_fulfilled THEN
      SELECT i.id INTO returned_id
      FROM inventory i
      WHERE i.user_id = NEW.user_id
        AND COALESCE(i.sold, 0) = 0
        AND i.data->>'cashout_return_id' = NEW.id
        AND i.data->>'cashout_return_index' = idx::text
      ORDER BY i.created_at DESC
      LIMIT 1;

      IF returned_id IS NULL THEN
        -- The admin route inserts the returned row immediately before updating
        -- this cashout. Tag the newest exact card match so future calls can refer
        -- to the precise inventory row instead of guessing by name/value alone.
        SELECT i.id INTO candidate_id
        FROM inventory i
        WHERE i.user_id = NEW.user_id
          AND COALESCE(i.sold, 0) = 0
          AND i.card_id = target_card_id
          AND ABS(COALESCE(i.value, 0) - target_card_value) < 0.0001
          AND COALESCE(i.rarity, '') = COALESCE(target_card_rarity, '')
          AND COALESCE(i.card_image_url, '') = COALESCE(target_card_image, '')
          AND COALESCE(i.pack_name, '') = COALESCE(target_card_pack, '')
          AND COALESCE(i.data->>'cashout_return_id', '') = ''
          AND i.created_at >= statement_timestamp() - interval '30 seconds'
        ORDER BY i.created_at DESC
        LIMIT 1;

        IF candidate_id IS NULL THEN
          RAISE EXCEPTION 'Could not identify returned inventory row for cashout card index %', idx
            USING ERRCODE = 'P0001';
        END IF;

        UPDATE inventory
        SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
          'cashout_return_id', NEW.id,
          'cashout_return_index', idx
        )
        WHERE id = candidate_id;
      ELSE
        -- The route may insert the same still-unfulfilled card again on a later
        -- partial-fulfillment call. Remove exactly one fresh untagged duplicate.
        SELECT i.id INTO candidate_id
        FROM inventory i
        WHERE i.user_id = NEW.user_id
          AND COALESCE(i.sold, 0) = 0
          AND i.card_id = target_card_id
          AND ABS(COALESCE(i.value, 0) - target_card_value) < 0.0001
          AND COALESCE(i.rarity, '') = COALESCE(target_card_rarity, '')
          AND COALESCE(i.card_image_url, '') = COALESCE(target_card_image, '')
          AND COALESCE(i.pack_name, '') = COALESCE(target_card_pack, '')
          AND COALESCE(i.data->>'cashout_return_id', '') = ''
          AND i.created_at >= statement_timestamp() - interval '30 seconds'
        ORDER BY i.created_at DESC
        LIMIT 1;

        IF candidate_id IS NOT NULL THEN
          DELETE FROM inventory WHERE id = candidate_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashout_return_duplication ON cashout_requests;

CREATE TRIGGER trg_cashout_return_duplication
AFTER UPDATE OF fulfilled_card_ids ON cashout_requests
FOR EACH ROW
EXECUTE FUNCTION prevent_cashout_return_duplication();
