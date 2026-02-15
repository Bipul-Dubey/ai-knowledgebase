import { login, signup, verifyAccount } from "@/apis/authentications";
import {
  ApiResponse,
  LoginPayload,
  LoginUser,
  SignupPayload,
  VerifyAccountData,
  VerifyAccountPayload,
} from "@/types/apis";
import { useMutation } from "@tanstack/react-query";

export const useSignup = () => {
  return useMutation({
    mutationFn: (payload: SignupPayload) => signup(payload),
  });
};

export const useLogin = () => {
  return useMutation<ApiResponse<LoginUser>, Error, LoginPayload>({
    mutationFn: login,
  });
};

export const useVerifyAccount = () => {
  return useMutation<
    ApiResponse<VerifyAccountData | null>,
    Error,
    VerifyAccountPayload
  >({
    mutationFn: verifyAccount,
  });
};
