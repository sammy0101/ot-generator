export const pdfScript = `
    async function generatePDF() {
        if(currentRecords.length === 0) return;
        const btn = document.getElementById('pdfBtn');
        btn.innerText = "生成中..."; btn.disabled = true;
        try {
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
            
            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontBytes = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-tc@4.5.12/files/noto-sans-tc-all-400-normal.woff').then(res => res.arrayBuffer());
            const chineseFont = await pdfDoc.embedFont(fontBytes);

            const page = pdfDoc.addPage([595.28, 841.89]);
            const { width, height } = page.getSize();
            let yPos = height - 60;
            const marginX = 40;

            const colorBlack = rgb(0, 0, 0);
            const colorGreen = rgb(0, 0.5, 0);
            const colorOrange = rgb(0.85, 0.5, 0);

            const monthStr = document.getElementById('queryMonth').value;
            page.drawText(monthStr, { x: marginX, y: yPos, size: 20, font: helveticaBold });
            page.drawText(' OT/當更/交通 記錄表', { x: marginX + 90, y: yPos, size: 20, font: chineseFont });
            
            // === 新增：印出名字 ===
            if (window.USER_NAME) {
                const nameWidth = chineseFont.widthOfTextAtSize(window.USER_NAME, 14);
                page.drawText(window.USER_NAME, { 
                    x: width - marginX - nameWidth, 
                    y: yPos, 
                    size: 14, 
                    font: chineseFont,
                    color: rgb(0.3, 0.3, 0.3)
                });
            }
            // ==================

            yPos -= 40;

            // ... (其餘 PDF 生成代碼保持不變，因為篇幅關係省略，請使用上一版代碼，僅加入上面那段名字邏輯) ...
            const col = { d: 40, item: 130, detail: 350, val: 480 };
            const fontSize = 11;
            const drawTxt = (text, x, font, color=colorBlack) => 
                page.drawText(text, { x, y: yPos, size: fontSize, font, color });

            drawTxt('日期', col.d, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('項目/地點', col.item, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('時間/詳情', col.detail, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('時數/金額', col.val, chineseFont, rgb(0.5,0.5,0.5));
            
            page.drawLine({ start: { x: marginX, y: yPos-5 }, end: { x: width-marginX, y: yPos-5 }, thickness: 1, color: rgb(0.8,0.8,0.8) });
            yPos -= 25;

            for (const r of currentRecords) {
                const amount = Number(r.amount) || 0; 
                if (r.type !== 'hourly' && amount === 0) continue;

                let itemStr = '', detailStr = '', valStr = '';
                let detailFont = helvetica; 
                let rowColor = colorBlack;

                if (r.type === 'hourly') {
                    itemStr = r.location || 'OT';
                    const mins = getMinutesDiff(r.start, r.end);
                    detailStr = \`\${r.start.replace(':','')} - \${r.end.replace(':','')}\`;
                    valStr = formatHours(mins) + ' hr';
                    rowColor = colorBlack;
                } else if (r.type === 'transport') {
                    itemStr = '交通費';
                    detailStr = r.location ? \`(\${r.location})\` : '-';
                    detailFont = chineseFont; 
                    valStr = '$' + amount;
                    rowColor = colorOrange;
                } else if (r.type === 'oncall') {
                    itemStr = '當更 On-Call';
                    const startD = r.date.split('-')[2];
                    const endD = r.endDate ? r.endDate.split('-')[2] : '';
                    detailStr = \`\${startD}日 - \${endD}日\`;
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                } else { 
                    itemStr = 'Call';
                    detailStr = r.location ? \`(\${r.location})\` : '-';
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                }

                drawTxt(r.date, col.d, helvetica);
                
                const safeItem = itemStr.length > 20 ? itemStr.substring(0,19)+'...' : itemStr;
                drawTxt(safeItem, col.item, chineseFont);
                
                drawTxt(detailStr, col.detail, detailFont);
                
                drawTxt(valStr, col.val, helveticaBold, rowColor);

                page.drawLine({ start: { x: marginX, y: yPos-8 }, end: { x: width-marginX, y: yPos-8 }, thickness: 0.5, color: rgb(0.9,0.9,0.9) });
                yPos -= 25;
                
                if (yPos < 50) { pdfDoc.addPage([595.28, 841.89]); yPos = height - 50; }
            }

            yPos -= 10;
            page.drawLine({ start: { x: marginX, y: yPos }, end: { x: width-marginX, y: yPos }, thickness: 1 });
            yPos -= 25;

            drawTxt("總時數: ", 350, chineseFont);
            drawTxt(formatHours(grandTotalMinutes) + " hr", 410, helveticaBold);
            yPos -= 20;

            drawTxt("總收入: ", 350, chineseFont);
            drawTxt("$" + grandTotalMoney, 410, helveticaBold, colorGreen);
            yPos -= 20;

            drawTxt("總交通: ", 350, chineseFont);
            drawTxt("$" + grandTotalTransport, 410, helveticaBold, colorOrange);
            yPos -= 20;

            const totalAll = grandTotalMoney + grandTotalTransport;
            drawTxt("總計:", 350, chineseFont); 
            drawTxt("$" + totalAll, 410, helveticaBold, colorBlack); 
            
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = \`Report_\${monthStr}.pdf\`;
            link.click();

        } catch(err) { console.error(err); alert("生成失敗: " + err.message); } 
        finally { btn.disabled = false; btn.innerText = "下載 PDF 報表"; }
    }
`;
