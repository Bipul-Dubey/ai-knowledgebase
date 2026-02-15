import { ENV } from "@/constants/environments";
import {
  ApiResponse,
  LoginPayload,
  LoginUser,
  SignupPayload,
  VerifyAccountData,
  VerifyAccountPayload,
} from "@/types/apis";
import axios from "axios";

export const signup = async (payload: SignupPayload) => {
  const response = await axios.post(`${ENV.BASE_API_URL}/signup`, payload);
  return response.data;
};

export const login = async (
  payload: LoginPayload,
): Promise<ApiResponse<LoginUser>> => {
  const res = await axios.post<ApiResponse<LoginUser>>(
    `${ENV.BASE_API_URL}/login`,
    payload,
    { withCredentials: true },
  );

  return res.data;
};

export const verifyAccount = async (
  payload: VerifyAccountPayload,
): Promise<ApiResponse<VerifyAccountData | null>> => {
  const res = await axios.post<ApiResponse<VerifyAccountData | null>>(
    `${ENV.BASE_API_URL}/verify-account`,
    payload,
  );

  return res.data;
};
