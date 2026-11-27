import { htmlContent } from './html.js';
import { logicScript } from './logic.js';
import { pdfScript } from './pdf.js';

export function getHtml(userName = '', isAuthenticated = false) {
    const safeNameJson = JSON.stringify(userName || '').replace(/</g, '\\u003c');
    const authBool = isAuthenticated ? 'true' : 'false';

    const scripts = `
        <script>
            window.USER_NAME = ${safeNameJson};
            window.INITIAL_AUTH = ${authBool};
            ${logicScript}
            ${pdfScript}
        </script>
    `;

    // 使用回呼函式避免字串內含 "$'" 被 replace() 解析為後文插入符號
    return htmlContent.replace('<!--APP_SCRIPTS-->', () => scripts);
}
