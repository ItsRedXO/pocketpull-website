-- Cashout partial fulfillment returns unselected cards to inventory before updating
-- fulfilled_card_ids. If a later fulfillment selects one of those returned cards,
-- remove the returned inventory copy so the same card cannot remain in inventory
-- while also being shipped.

CREATE OR REPLACE FUNCTION prevent_cashout_return_duplication()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_ids jsonb := COALESCE(OLD.fulfilled_card_ids, '[]'::jsonb);
  new_ids jsonb := COALESCE(NEW.fulfilled_card_ids, '[]'::jsonb);
  idx_text text;
  idx integer;
  card jsonb;
  card_name text;
  card_id text;
  card_value numeric;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.fulfilled_card_ids IS NULL OR NEW.fulfilled_card_ids = OLD.fulfilled_card_ids THEN
    RETURN NEW;
  END IF;

  FOR idx_text IN
    SELECT value
    FROM jsonb_array_elements_text(new_ids) AS x(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(old_ids) AS y(value)
      WHERE y.value = x.value
    )
  LOOP
    BEGIN
      idx := idx_text::integer;
    EXCEPTION WHEN invalid_text_representation THEN
      CONTINUE;
    END;

    card := NEW.cards_json::jsonb -> idx;
    IF card IS NULL OR jsonb_typeof(card) <> 'object' THEN
      CONTINUE;
    END IF;

    card_name := COALESCE(card->>'card_name', card->>'cardName', 'Unknown Card');
    card_id := regexp_replace(lower(card_name), '[^a-z0-9]+', '-', 'g');
    card_value := COALESCE(NULLIF(card->>'value', '')::numeric, 0);

    -- The admin route creates returned inventory immediately before updating
    -- this request. Prefer the newest matching unsold copy created since the
    -- previous cashout update. Never touch an already-sold inventory row.
    DELETE FROM inventory
    WHERE id = (
      SELECT i.id
      FROM inventory i
      WHERE i.user_id = NEW.user_id
        AND COALESCE(i.sold, 0) = 0
        AND i.card_id = card_id
        AND ABS(COALESCE(i.value, 0) - card_value) < 0.0001
        AND i.created_at >= COALESCE(OLD.updated_at, OLD.created_at)
      ORDER BY i.created_at DESC
      LIMIT 1
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashout_return_duplication ON cashout_requests;

CREATE TRIGGER trg_cashout_return_duplication
AFTER UPDATE OF fulfilled_card_ids ON cashout_requests
FOR EACH ROW
EXECUTE FUNCTION prevent_cashout_return_duplication();
