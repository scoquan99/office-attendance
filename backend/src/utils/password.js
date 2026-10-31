import crypto from 'node:crypto';

// Bỏ các ký tự dễ nhầm khi đọc/đọc to cho người khác: 0 O, 1 l I
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

// Mật khẩu tạm ngẫu nhiên (dùng CSPRNG của Node, không dùng Math.random).
export function generateTempPassword(length = 12) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return out;
}
