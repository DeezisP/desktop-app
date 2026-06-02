export interface UserAddress {
  id: number
  label: string | null
  firstname: string
  lastname: string
  phone: string
  houseNumber: string
  subDistrict: string
  district: string
  province: string
  postalCode: string
  isDefault: boolean
}

export interface AuthUser {
  id: number
  username: string
  email: string
  firstname: string | null
  lastname: string | null
  phone: string | null
  houseNumber: string | null
  subDistrict: string | null
  district: string | null
  province: string | null
  postalCode: string | null
  role: string
  provider: 'LOCAL' | 'GOOGLE'
  addresses: UserAddress[]
}

export interface LoginResponse extends AuthUser {
  accessToken: string
}

/** Returned when the device is not yet trusted — OTP sent to email */
export interface DeviceOtpRequired {
  requiresDeviceVerification: true
  maskedEmail: string
}

export type LoginApiResult = LoginResponse | DeviceOtpRequired

export interface RefreshResponse {
  token: string
}
