import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSearchStore = defineStore('search', () => {
  const searchValue = ref('');
  const searchType = ref<'music' | 'video' | string | number>('music');

  const setSearchValue = (value: string) => {
    searchValue.value = value;
  };

  const setSearchType = (type: 'music' | 'video' | string | number) => {
    searchType.value = type;
  };

  return {
    searchValue,
    searchType,
    setSearchValue,
    setSearchType
  };
});
