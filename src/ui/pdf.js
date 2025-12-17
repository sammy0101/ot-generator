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

            const monthStr = document.getElementById('queryMonth').value;
            page.drawText(monthStr, { x: marginX, y: yPos, size: 20, font: helveticaBold });
            page.drawText(' OT/當更 記錄表', { x: marginX + 90, y: yPos, size: 20, font: chineseFont });
            yPos -= 40;

            const col = { d: 40, item: 130, detail: 350, val: 480 };
            const fontSize = 11;
            const drawTxt = (text, x, font, color=rgb(0,0,0)) => 
                page.drawText(text, { x, y: yPos, size: fontSize, font, color });

            drawTxt('日期', col.d, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('項目/地點', col.item, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('時間/詳情', col.detail, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('時數/金額', col.val, chineseFont, rgb(0.5,0.5,0.5));
            
            page.drawLine({ start: { x: marginX, y: yPos-5 }, end: { x: width-marginX, y: yPos-5 }, thickness: 1, color: rgb(0.8,0.8,0.8) });
            yPos -= 25;

            for (const r of currentRecords) {
                let itemStr = '', detailStr = '', valStr = '';
                let isMoney = false;

                if (r.type === 'hourly') {
                    itemStr = r.location || 'OT';
                    const mins = getMinutesDiff(r.start, r.end);
                    detailStr = \`\${r.start.replace(':','')} - \${r.end.replace(':','')}\`;
                    valStr = formatHours(mins) + ' hr';
                } else if (r.type === 'oncall') {
                    itemStr = '當更 On-Call';
                    detailStr = r.endDate ? \`~ \${r.endDate}\` : '';
                    valStr = '$' + r.amount;
                    isMoney = true;
                } else { 
                    itemStr = 'Call';
                    valStr = '$' + r.amount;
                    isMoney = true;
                }

                drawTxt(r.date, col.d, helvetica);
                
                const safeItem = itemStr.length > 15 ? itemStr.substring(0,14)+'...' : itemStr;
                drawTxt(safeItem, col.item, chineseFont);
                
                drawTxt(detailStr, col.detail, helvetica);
                drawTxt(valStr, col.val, helveticaBold, isMoney ? rgb(0,0.5,0) : rgb(0,0,0));

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
            drawTxt("總金額: ", 350, chineseFont);
            drawTxt("$" + grandTotalMoney, 410, helveticaBold, rgb(0,0.5,0));

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
