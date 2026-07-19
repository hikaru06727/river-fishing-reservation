import {
  updateProfileAddress as updateProfileAddressRepo,
  type ProfileAddressFields,
} from "@/lib/repositories/profiles.repository";

export type ProfileAddressUpdateInput = {
  fullName?: string;
  phone?: string | null;
  postalCode?: string | null;
  prefecture?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
};

/**
 * チェックアウトの「この住所を今後のために保存する」チェック時に呼ぶ（Phase 20）。
 * チェックを外した場合はこの関数自体を呼ばない（呼び出し元の責務）。
 *
 * input の各フィールドは undefined なら更新対象外（既存値を維持）、null なら
 * 明示的にクリアする。例えば店舗受け取り注文（住所欄なし）では住所系フィールドを
 * undefined のまま渡すことで、過去に保存済みの配送先住所を誤って消さない。
 */
export async function updateProfileAddress(
  userId: string,
  input: ProfileAddressUpdateInput,
): Promise<void> {
  const fields: ProfileAddressFields = {};
  if (input.fullName !== undefined) fields.full_name = input.fullName;
  if (input.phone !== undefined) fields.phone = input.phone;
  if (input.postalCode !== undefined) fields.postal_code = input.postalCode;
  if (input.prefecture !== undefined) fields.prefecture = input.prefecture;
  if (input.addressLine1 !== undefined) fields.address_line1 = input.addressLine1;
  if (input.addressLine2 !== undefined) fields.address_line2 = input.addressLine2;

  await updateProfileAddressRepo(userId, fields);
}
