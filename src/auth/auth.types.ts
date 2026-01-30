export type JwtPayload = {
  sub: string;
  email: string;
};

export type User = {
  id: string;
  email: string;
  username?: string;
  passwordHash: string;
  provider?: 'password' | 'google';
  googleSub?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other';
  birthdate?: string;
};
