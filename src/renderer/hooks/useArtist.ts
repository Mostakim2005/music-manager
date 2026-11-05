import { useRouter } from 'vue-router';

export const useArtist = () => {
  const router = useRouter();

  /**
   */
  const navigateToArtist = (id: number) => {
    router.push(`/artist/detail/${id}`);
  };

  return {
    navigateToArtist
  };
};
