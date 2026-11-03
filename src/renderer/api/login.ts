export const logout = async () => {
  return { data: { code: 200 } };
};

export const getLoginStatus = async () => {
  return { data: { code: 200, profile: null } };
};
