import nodemailer from "nodemailer";
import { config } from "../config";

// Nếu chưa cấu hình SMTP → chế độ DEV: in link ra console (không gửi mail thật).
const enabled = Boolean(config.smtp.host && config.smtp.user);

const transporter = enabled
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

async function send(to: string, subject: string, html: string, devLink: string) {
  if (!transporter) {
    console.log(`\n[email:DEV] Tới: ${to}\n[email:DEV] ${subject}\n[email:DEV] Link: ${devLink}\n`);
    return;
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, html });
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
