import youtubeService from '@/services/youtubeService';

export const getMvUrl = async (id: number | string) => {
  try {
    const rawId = String(id || '');
    const videoId = youtubeService.extractVideoId(rawId) || rawId;
    const stream = await youtubeService.getStreamUrl(videoId, { kind: 'video' });
    return {
      data: {
        code: 200,
        data: {
          id: videoId,
          url: stream.videoUrl,
          r: 1080
        }
      }
    };
  } catch (error) {
    console.error('[API] getMvUrl failed:', error);
    return {
      data: {
        code: 404,
        data: {
          id,
          url: '',
          r: 0
        }
      }
    };
  }
};
