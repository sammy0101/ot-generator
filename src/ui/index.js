import { htmlContent } from './html.js';
import { logicScript } from './logic.js';
import { pdfScript } from './pdf.js';

function escapeHtmlAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function getHtml(options = {}) {
    const userName = options.userName || '';
    const isAuthenticated = Boolean(options.isAuthenticated);
    const shareMonth = options.shareMonth || '';
    const origin = options.origin || '';

    const safeNameJson = JSON.stringify(userName).replace(/</g, '\\u003c');
    const authBool = isAuthenticated ? 'true' : 'false';

    let titleText = userName ? `OT 記錄器 Pro - ${userName}` : 'OT 記錄器 Pro';
    let ogTitle = titleText;
    let ogDesc = '加班、當更與交通費月結記錄工具';
    let ogUrl = origin ? `${origin}/` : '/';

    if (shareMonth) {
        const [yr, mo] = shareMonth.split('-');
        const monthDisplay = `${yr}年${parseInt(mo, 10)}月`;
        titleText = `${monthDisplay} OT 記錄報表${userName ? ' - ' + userName : ''}`;
        ogTitle = `${monthDisplay} OT 記錄報表${userName ? ' (' + userName + ')' : ''}`;
        ogDesc = `點擊查看 ${shareMonth} OT / 當更 / 交通月結明細與匯出 PDF`;
        ogUrl = `${origin}/?view=share&month=${shareMonth}`;
    }

    // 128x128 小於 WhatsApp 300px 大圖門檻，會顯示為文字旁的小縮圖
    const iconUrl = 'https://cdn-icons-png.flaticon.com/128/2535/2535556.png';

    const metaTags = `
    <title>${escapeHtmlAttr(titleText)}</title>
    <meta name="description" content="${escapeHtmlAttr(ogDesc)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtmlAttr(ogUrl)}">
    <meta property="og:title" content="${escapeHtmlAttr(ogTitle)}">
    <meta property="og:description" content="${escapeHtmlAttr(ogDesc)}">
    <meta property="og:image" content="${iconUrl}">
    <meta property="og:image:width" content="128">
    <meta property="og:image:height" content="128">
    <meta name="twitter:card" content="summary">
    <link rel="apple-touch-icon" href="${iconUrl}">`;

    const scripts = `
        <script>
            window.USER_NAME = ${safeNameJson};
            window.INITIAL_AUTH = ${authBool};
            ${logicScript}
            ${pdfScript}
        </script>
    `;

    return htmlContent
        .replace('<!--APP_META-->', () => metaTags)
        .replace('<!--APP_SCRIPTS-->', () => scripts);
}
