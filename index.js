require("dotenv").config();
const axios = require("axios");
const cron = require("node-cron");

const TOKEN = process.env.M2PROXY_TOKEN;
const API_URL = `https://api.m2proxy.com/user/data/getlistproxy?token=${TOKEN}`;

// Cấu hình Telegram từ .env
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Hàm gửi tin nhắn Telegram
async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML", // Sử dụng HTML để định dạng tin nhắn cho đẹp
    });
  } catch (error) {
    console.error(
      "❌ Lỗi gửi Telegram:",
      error.response?.data || error.message
    );
  }
}

async function checkProxyStatus() {
  try {
    console.log(`\n[${new Date().toLocaleString()}] --- ĐANG KIỂM TRA ---`);

    const response = await axios.get(API_URL);

    if (response.data.Status.toLowerCase() !== "success") {
      console.error("❌ Lỗi API:", response.data.Message);
      return;
    }

    const proxyList = response.data.Data;
    const now = new Date();
    let warnings = [];
    let telegramMessage = `⚠️ <b>CẢNH BÁO PROXY SẮP HẾT HẠN</b>\n\n`;

    proxyList.forEach((proxy) => {
      const expiryDate = new Date(proxy.expired_date);
      const diffTime = expiryDate - now;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      // Kiểm tra nếu còn dưới 1 ngày (24 giờ)
      if (diffDays > 0 && diffDays <= 1) {
        const hoursLeft = (diffDays * 24).toFixed(1);

        // Thêm vào bảng log máy tính
        warnings.push({
          id: proxy.id,
          note: proxy.note || "Trống",
          timeLeft: `${hoursLeft} giờ`,
        });

        // Thêm vào nội dung tin nhắn Telegram
        telegramMessage += `📌 <b>Note:</b> ${proxy.note || "Trống"}\n`;
        telegramMessage += `🔹 ID: <code>${proxy.id}</code>\n`;
        telegramMessage += `🔹 Gói: ${proxy.package_name}\n`;
        telegramMessage += `🔹 Còn lại: <b>${hoursLeft} giờ</b>\n`;
        telegramMessage += `---------------------------\n`;
      }
    });

    if (warnings.length > 0) {
      console.warn("⚠️ Tìm thấy proxy sắp hết hạn, đang gửi Telegram...");
      console.table(warnings);

      // Gửi tin nhắn đến Telegram
      await sendTelegram(telegramMessage);
    } else {
      console.log("✅ Không có proxy nào sắp hết hạn.");
    }
  } catch (error) {
    console.error("❌ Lỗi hệ thống:", error.message);
  }
}

// Chạy mỗi 1 phút một lần
cron.schedule(
  "0 8 * * *",
  () => {
    checkProxyStatus();
  },
  {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh", // Đảm bảo chạy đúng giờ Việt Nam
  }
);

console.log("🚀 Bot đã bật! Chế độ kiểm tra: 1 phút/lần.");
console.log("Thông báo sẽ được gửi qua Telegram nếu có proxy sắp hết hạn.");

// Chạy thử luôn lần đầu khi bật code
checkProxyStatus();
