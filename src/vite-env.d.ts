/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_ADSENSE?: string;
  readonly VITE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_AD_SLOT_LEFT?: string;
  readonly VITE_AD_SLOT_RIGHT?: string;
  readonly VITE_AD_SLOT_MOBILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
