import type { MessageApi } from 'naive-ui';

/**
 */
export const selectDirectory = async (message: MessageApi): Promise<string | undefined> => {
  try {
    const result = await window.api.selectDirectory();
    if (result.filePaths?.[0]) {
      return result.filePaths[0];
    }
  } catch (error) {
    console.error('Failed to choose folder:', error);
    message.error('Failed to choose folder');
  }
  return undefined;
};

/**
 */
export const openDirectory = (path: string | undefined, message: MessageApi, showTip = true) => {
  if (path) {
    window.api.openDirectory(path);
  } else if (showTip) {
    message.info('Directory does not exist');
  }
};
