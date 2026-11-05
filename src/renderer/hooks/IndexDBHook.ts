import { ref } from 'vue';

export interface StoreConfig<T extends string> {
  name: T;
  keyPath?: string;
}

const useIndexedDB = async <T extends string, S extends Record<T, Record<string, any>>>(
  dbName: string,
  stores: StoreConfig<T>[],
  version: number = 1
) => {
  const db = ref<IDBDatabase | null>(null);

  const initDB = () => {
    return new Promise<void>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve();
        return;
      }
      const request = indexedDB.open(dbName, version);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        stores.forEach((store) => {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, {
              keyPath: store.keyPath || 'id',
              autoIncrement: true
            });
          }
        });
      };

      request.onsuccess = (event: any) => {
        db.value = event.target.result;
        resolve();
      };

      request.onerror = (event: any) => {
        reject(event.target.error);
      };
    });
  };

  await initDB();

  const addData = <K extends T>(storeName: K, value: S[K]) => {
    return new Promise<void>((resolve, reject) => {
      if (!db.value) return resolve();
      const tx = db.value.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      const request = store.add(value);

      request.onsuccess = () => {
        console.log('Success');
        resolve();
      };

      request.onerror = (event) => {
        console.error('Failed to add:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const saveData = <K extends T>(storeName: K, value: S[K]) => {
    return new Promise<void>((resolve, reject) => {
      if (!db.value) return resolve();
      const tx = db.value.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => {
        console.log('Success');
        resolve();
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const getData = <K extends T>(storeName: K, key: string | number) => {
    return new Promise<S[K]>((resolve, reject) => {
      if (!db.value) return resolve(undefined as any);
      const tx = db.value.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = (event) => {
        if (event.target) {
          resolve((event.target as IDBRequest).result);
        } else {
          reject('Event target is empty');
        }
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const deleteData = <K extends T>(storeName: K, key: string | number) => {
    return new Promise<void>((resolve, reject) => {
      if (!db.value) return resolve();
      const tx = db.value.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log('Deleted');
        resolve();
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const getAllData = <K extends T>(storeName: K) => {
    return new Promise<S[K][]>((resolve, reject) => {
      if (!db.value) return resolve([]);
      const tx = db.value.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = (event) => {
        if (event.target) {
          resolve((event.target as IDBRequest).result);
        } else {
          reject('Event target is empty');
        }
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const getDataWithPagination = <K extends T>(storeName: K, page: number, pageSize: number) => {
    return new Promise<S[K][]>((resolve, reject) => {
      if (!db.value) return resolve([]);
      const tx = db.value.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.openCursor();
      const results: S[K][] = [];
      let index = 0;
      const skip = (page - 1) * pageSize;

      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(results);
          return;
        }

        if (index >= skip && results.length < pageSize) {
          results.push(cursor.value);
        }

        index++;
        cursor.continue();
      };

      request.onerror = (event: any) => {
        reject(event.target.error);
      };
    });
  };

  return {
    initDB,
    addData,
    saveData,
    getData,
    deleteData,
    getAllData,
    getDataWithPagination
  };
};

type MusicDBInstance = Awaited<ReturnType<typeof useIndexedDB>>;
let musicDBPromise: Promise<MusicDBInstance> | null = null;

function getMusicDBInstance(): Promise<MusicDBInstance> {
  if (!musicDBPromise) {
    musicDBPromise = useIndexedDB(
      'musicDB',
      [
        { name: 'music', keyPath: 'id' },
        { name: 'music_lyric', keyPath: 'id' },
        { name: 'api_cache', keyPath: 'id' },
        { name: 'music_url_cache', keyPath: 'id' },
        { name: 'music_failed_cache', keyPath: 'id' }
      ],
      3
    );
  }
  return musicDBPromise;
}

export const musicDB = {
  initDB: async () => (await getMusicDBInstance()).initDB(),
  addData: async (storeName: any, value: any) =>
    (await getMusicDBInstance()).addData(storeName, value),
  saveData: async (storeName: any, value: any) =>
    (await getMusicDBInstance()).saveData(storeName, value),
  getData: async (storeName: any, key: string | number) =>
    (await getMusicDBInstance()).getData(storeName, key),
  deleteData: async (storeName: any, key: string | number) =>
    (await getMusicDBInstance()).deleteData(storeName, key),
  getAllData: async (storeName: any) => (await getMusicDBInstance()).getAllData(storeName),
  getDataWithPagination: async (storeName: any, page: number, pageSize: number) =>
    (await getMusicDBInstance()).getDataWithPagination(storeName, page, pageSize)
};

export default useIndexedDB;
