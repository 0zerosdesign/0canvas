import { createDirectus, rest, readItems } from '@directus/sdk';
import { DIRECTUS_URL } from '../api/config';

export const directus = createDirectus(DIRECTUS_URL).with(rest());
export { readItems };

export const CMS_COLLECTIONS = {
    shots: 'shots',
};

export const DIRECTUS_CONNECTED = true;
