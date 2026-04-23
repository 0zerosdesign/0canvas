import { createDirectus, rest, deleteCollection, staticToken } from '@directus/sdk';
const client = createDirectus('https://cms.0research.zeros.design')
  .with(staticToken('DK7H4wR7I5Ly-eQEbaVevXcjoh0yuwUA'))
  .with(rest());
async function run() {
  try {
    await client.request(deleteCollection('media'));
    console.log('Deleted media');
  } catch(e) {}
  try {
    await client.request(deleteCollection('feeds'));
    console.log('Deleted feeds');
  } catch(e) {}
}
run();
