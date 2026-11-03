export function getUserDetail(_uid: number) {
  return Promise.resolve({ data: { code: 200 } });
}

export function getUserPlaylist(_uid: number, _limit: number = 30, _offset: number = 0) {
  return Promise.resolve({ data: { playlist: [], code: 200 } });
}

export function getUserRecord(_uid: number, _type: number = 0) {
  return Promise.resolve({ data: { allData: [], weekData: [], code: 200 } });
}

export function getRecentSongs(_limit: number = 100) {
  return Promise.resolve({ data: { data: { list: [] }, code: 200 } });
}

export function getRecentPlaylists(_limit: number = 100) {
  return Promise.resolve({ data: { data: { list: [] }, code: 200 } });
}

export function getRecentAlbums(_limit: number = 100) {
  return Promise.resolve({ data: { data: { list: [] }, code: 200 } });
}

export function getUserFollows(_uid: number, _limit: number = 30, _offset: number = 0) {
  return Promise.resolve({ data: { follow: [], code: 200 } });
}

export function getUserFollowers(_uid: number, _limit: number = 30, _offset: number = 0) {
  return Promise.resolve({ data: { followeds: [], code: 200 } });
}

export const getUserAccount = () => {
  return Promise.resolve({ data: { code: 200 } });
};

export const getUserAlbumSublist = () => {
  return Promise.resolve({ data: { data: [], count: 0, code: 200 } });
};
