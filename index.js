require("dotenv").config();
const axios = require("axios");
const cron = require("node-cron");

const M2PROXY_TOKEN = process.env.M2PROXY_TOKEN;
const ZINGPROXY_TOKEN = process.env.ZINGPROXY_TOKEN;

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Hàm gửi tin nhắn Telegram
async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("❌ Lỗi gửi Telegram:", error.response?.data || error.message);
  }
}

// ==========================================
// HÀM KIỂM TRA M2PROXY
// ==========================================
async function checkM2Proxy() {
  try {
    const API_URL = `https://api.m2proxy.com/user/data/getlistproxy?token=${M2PROXY_TOKEN}`;
    const response = await axios.get(API_URL);

    if (response.data.Status.toLowerCase() !== "success") {
      console.error("❌ Lỗi API M2Proxy:", response.data.Message);
      return;
    }

    const proxyList = response.data.Data;
    const now = new Date();
    let warnings = [];
    let telegramMessage = `⚠️ <b>[M2PROXY] SẮP HẾT HẠN</b>\n\n`;

    proxyList.forEach((proxy) => {
      const expiryDate = new Date(proxy.expired_date);
      const diffTime = expiryDate - now;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays > 0 && diffDays <= 2) {
        const hoursLeft = (diffDays * 24).toFixed(1);

        warnings.push({
          id: proxy.id,
          note: proxy.note || "Trống",
          timeLeft: `${hoursLeft} giờ`,
        });

        telegramMessage += `📌 <b>Note:</b> ${proxy.note || "Trống"}\n`;
        telegramMessage += `🔹 ID: <code>${proxy.id}</code>\n`;
        telegramMessage += `🔹 Socks: <code>${proxy.public_ip}:${proxy.socks_port}</code>\n`;
        telegramMessage += `🔹 Còn lại: <b>${hoursLeft} giờ</b>\n`;
        telegramMessage += `---------------------------\n`;
      }
    });

    if (warnings.length > 0) {
      console.warn("⚠️ [M2Proxy] Tìm thấy proxy sắp hết hạn!");
      console.table(warnings);
      await sendTelegram(telegramMessage);
    } else {
      console.log("✅ [M2Proxy] Không có proxy nào sắp hết hạn.");
    }
  } catch (error) {
    console.error("❌ Lỗi hệ thống M2Proxy:", error.message);
  }
}

// ==========================================
// HÀM KIỂM TRA ZINGPROXY
// ==========================================
async function checkZingProxy() {
  try {
    const API_URL = 'https://api.zingproxy.com/proxy/datacenter-private-ipv4/running';
    const response = await axios.get(API_URL, {
      headers: {
        'Authorization': `Bearer ${ZINGPROXY_TOKEN}`
      }
    });

    if (response.data.status !== "success") {
      console.error("❌ Lỗi API ZingProxy:", response.data.message);
      return;
    }

    const proxyList = response.data.proxies;
    const now = new Date();
    let warnings = [];
    let telegramMessage = `⚠️ <b>[ZINGPROXY] SẮP HẾT HẠN</b>\n\n`;

    proxyList.forEach((proxy) => {
      const expiryDate = new Date(proxy.dateEnd); // ZingProxy dùng trường dateEnd
      const diffTime = expiryDate - now;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays > 0 && diffDays <= 2) {
        const hoursLeft = (diffDays * 24).toFixed(1);

        warnings.push({
          id: proxy.resourceId,
          note: proxy.note || "Trống",
          timeLeft: `${hoursLeft} giờ`,
        });

        telegramMessage += `📌 <b>Note:</b> ${proxy.note || "Trống"}\n`;
        telegramMessage += `🔹 ID: <code>${proxy.resourceId}</code>\n`;
        // Hiển thị portSocks5 (Nếu bạn dùng portHttp thì đổi thành proxy.portHttp)
        telegramMessage += `🔹 Proxy: <code>${proxy.ip}:${proxy.portSocks5}</code>\n`; 
        telegramMessage += `🔹 Còn lại: <b>${hoursLeft} giờ</b>\n`;
        telegramMessage += `---------------------------\n`;
      }
    });

    if (warnings.length > 0) {
      console.warn("⚠️ [ZingProxy] Tìm thấy proxy sắp hết hạn!");
      console.table(warnings);
      await sendTelegram(telegramMessage);
    } else {
      console.log("✅ [ZingProxy] Không có proxy nào sắp hết hạn.");
    }
  } catch (error) {
    console.error("❌ Lỗi hệ thống ZingProxy:", error.message);
  }
}

// ==========================================
// HÀM CHẠY TỔNG HỢP
// ==========================================
async function runAllChecks() {
  console.log(`\n[${new Date().toLocaleString()}] --- ĐANG KIỂM TRA TẤT CẢ PROXY ---`);
  await checkM2Proxy();
  await checkZingProxy();
  console.log(`[${new Date().toLocaleString()}] --- HOÀN TẤT KIỂM TRA ---`);
}

// Chạy cronjob vào 8:00 sáng mỗi ngày
// (Nếu muốn chạy 1 phút 1 lần hãy đổi "0 8 * * *" thành "* * * * *")
cron.schedule(
  "0 8 * * *", 
  () => {
    runAllChecks();
  },
  {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh", 
  }
);

console.log("🚀 Bot đã bật! Chế độ kiểm tra: 8h00 Sáng mỗi ngày.");
console.log("Thông báo sẽ được gửi qua Telegram nếu có proxy sắp hết hạn (< 24h).");

// Chạy thử luôn lần đầu khi bật code
runAllChecks();