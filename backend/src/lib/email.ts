import { config } from "../config";

// Nếu chưa cấu hình Brevo API key → chế độ DEV: in link ra console (không gửi mail thật).
const enabled = Boolean(config.brevo.apiKey);

// Brevo yêu cầu sender là { email, name } riêng biệt, trong khi config.smtp.from
// thường ở dạng "Tên <email@domain.com>" → tách ra cho đúng định dạng.
function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim() };
  return { email: from.trim() };
}

async function send(to: string, subject: string, html: string, devLink: string) {
  if (!enabled) {
    console.log(`\n[email:DEV] Tới: ${to}\n[email:DEV] ${subject}\n[email:DEV] Link: ${devLink}\n`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.brevo.apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: parseFrom(config.smtp.from),
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API lỗi (${res.status}): ${body}`);
  }
}

export async function sendVerificationEmail(to: string, code: string) {
  // Link chỉ để TỰ ĐIỀN sẵn email + mã trên trang xác nhận; mã mới là thứ chính.
  const link = `${config.appUrl}/xac-nhan-email?email=${encodeURIComponent(to)}&code=${code}`;
  await send(
    to,
    "Mã xác nhận email — AutoGrade",
    `<p>Chào mừng đến AutoGrade!</p>
     <p>Mã xác nhận tài khoản của bạn là:</p>
     <p style="font-size:30px;font-weight:bold;letter-spacing:8px;margin:14px 0">${code}</p>
     <p>Nhập mã này vào trang xác nhận để kích hoạt tài khoản. Hoặc bấm vào liên kết để tự điền sẵn:
        <a href="${link}">${link}</a></p>
     <p style="color:#888;font-size:13px">Nếu không thấy email trong Hộp thư đến, hãy kiểm tra thư mục Spam/Quảng cáo.</p>`,
    `${link}   ·   Mã: ${code}`
  );
}

export async function sendPasswordResetEmail(to: string, code: string) {
  const link = `${config.appUrl}/quen-mat-khau?email=${encodeURIComponent(to)}&code=${code}`;
  await send(
    to,
    "Mã đặt lại mật khẩu — AutoGrade",
    `<p>Bạn yêu cầu đặt lại mật khẩu.</p>
     <p>Mã đặt lại (hết hạn sau 1 giờ) là:</p>
     <p style="font-size:30px;font-weight:bold;letter-spacing:8px;margin:14px 0">${code}</p>
     <p>Nhập mã này cùng mật khẩu mới, hoặc bấm liên kết để tự điền sẵn: <a href="${link}">${link}</a></p>
     <p style="color:#888;font-size:13px">Nếu không thấy email trong Hộp thư đến, hãy kiểm tra thư mục Spam/Quảng cáo.</p>`,
    `${link}   ·   Mã: ${code}`
  );
}
