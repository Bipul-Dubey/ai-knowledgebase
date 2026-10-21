import {
  forgotPassword,
  login,
  resetPasswordByEmail,
  signup,
  verifyAccount,
} from "@/apis/authentications";
import {
  AccountVerificationPayload,
  ApiResponse,
  ForgotPasswordData,
  LoginPayload,
  LoginUser,
  ResetPasswordByEmailPayload,
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

export const useForgotPassword = () => {
  return useMutation<
    ApiResponse<ForgotPasswordData | null>,
    Error,
    AccountVerificationPayload
  >({
    mutationFn: forgotPassword,
  });
};

export const useResetPasswordByEmail = () => {
  return useMutation<ApiResponse<null>, Error, ResetPasswordByEmailPayload>({
    mutationFn: resetPasswordByEmail,
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
