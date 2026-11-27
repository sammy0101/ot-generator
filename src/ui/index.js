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

    return htmlContent.replace('<!--APP_SCRIPTS-->', scripts);
}
