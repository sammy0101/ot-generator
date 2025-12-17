import { htmlContent } from './html.js';
import { logicScript } from './logic.js';
import { pdfScript } from './pdf.js';

export function getHtml() {
    // 組合 HTML: 結構 + <script> (邏輯 + PDF) </script>
    return `
        ${htmlContent}
        <script>
            ${logicScript}
            ${pdfScript}
        </script>
        </body>
        </html>
    `;
}
