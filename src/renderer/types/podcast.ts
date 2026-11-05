/**
 */

export type DjCategory = {
  id: number;
  name: string;
  pic56x56Url?: string;
  pic84x84Url?: string;
};

export type DjUser = {
  userId: number;
  nickname: string;
  avatarUrl: string;
};

export type DjRadio = {
  id: number;
  name: string;
  picUrl: string;
  desc: string;
  subCount: number;
  programCount: number;
  createTime: number;
  categoryId: number;
  category: string;
  radioFeeType: number;
  feeScope: number;
  dj: DjUser;
  subed?: boolean;
  rcmdText?: string;
};

export type DjMainSong = {
  id: number;
  name: string;
  duration: number;
};

export type DjProgramRadio = {
  id: number;
  name: string;
};

export type DjProgram = {
  id: number;
  mainSong: DjMainSong;
  radio: DjProgramRadio;
  coverUrl: string;
  description: string;
  createTime: number;
  listenerCount: number;
  commentCount: number;
  liked: boolean;
  likedCount: number;
  name?: string;
};

export type DjSublistResponse = {
  djRadios: DjRadio[];
  count: number;
};

export type DjProgramResponse = {
  programs: DjProgram[];
  count: number;
};

export type DjDetailResponse = {
  data: DjRadio;
};

export type DjRecommendResponse = {
  djRadios: DjRadio[];
};

export type DjCategoryListResponse = {
  categories: DjCategory[];
};

export type DjTodayPerferedResponse = {
  data: DjProgram[];
};

export type DjToplistResponse = {
  toplist: DjRadio[];
};

export type DjRadioHotResponse = {
  djRadios: DjRadio[];
};

export type DjProgramDetailResponse = {
  program: DjProgram;
};

export type RecentDjResponse = {
  data: {
    list: DjProgram[];
  };
};

export type PersonalizedDjProgramResponse = {
  result: DjProgram[];
};
