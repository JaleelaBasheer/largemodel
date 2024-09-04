/* eslint-disable no-restricted-globals */

import { getFile } from '../Largecomponent/indexedDBHelper';

self.onmessage = async (event) => {
  const { type, fileName } = event.data;

  switch (type) {
    case 'load':
      const arrayBuffer = await getFile(fileName);
      self.postMessage({ type: 'loaded', fileName, arrayBuffer });
      break;

    case 'unload':
      // Handle unloading logic if needed
      self.postMessage({ type: 'unloaded', fileName });
      break;
  }
};
