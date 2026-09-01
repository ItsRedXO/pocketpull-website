import { createClient } from '@blinkdotnew/sdk';

const sdk:any=createClient({projectId:import.meta.env.VITE_BLINK_PROJECT_ID||'pocketpull-premium-site-b2nnhe2n',publishableKey:import.meta.env.VITE_BLINK_PUBLISHABLE_KEY||'blnk_pk_vT3Qhs4YE86jEwxvFWSg-5EcABJ06ofD',auth:{mode:'headless'}});

export const blink=sdk;
export const INVENTORY_CHANNEL='inventory-updates';
export const INVENTORY_UPDATED_EVENT='updated';
export const BATTLE_CHANNEL_PREFIX='battle-state';
export const BATTLE_LOBBY_CHANNEL='battle-lobby';
export const BATTLE_EVENTS={PHASE_CHANGE:'phase_change',ROUND_UPDATE:'round_update',SPIN_TOGGLE:'spin_toggle',BATTLE_FINISHED:'battle_finished',RESULTS_READY:'results_ready',COUNTDOWN_UPDATE:'countdown_update',BATTLE_CANCELED:'battle_canceled'};
