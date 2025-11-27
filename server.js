const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Admin API Key Authentication Middleware
const authenticateAdmin = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required. Include X-API-Key header.'
    });
  }

  const validKey = process.env.ADMIN_API_KEY || 'infrasap_admin_2024_secure_key';

  if (apiKey !== validKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  next();
};

// =====================================================
// EMAIL CONFIGURATION
// =====================================================
const EMAIL_CONFIG = {
  host: 'mail.privateemail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'no-reply@infrasap.com',
    pass: process.env.EMAIL_PASS || '@1Benazir2012'
  },
  tls: {
    rejectUnauthorized: false
  }
};

const transporter = nodemailer.createTransport(EMAIL_CONFIG);

transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Email server connection error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// =====================================================
// CURRENCY CONFIGURATIONS
// =====================================================
const CURRENCIES = {
  NGN: { symbol: 'NGN', name: 'Nigerian Naira', locale: 'en-NG' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'en-EU' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  ZAR: { symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling', locale: 'en-KE' },
  GHS: { symbol: 'GH₵', name: 'Ghanaian Cedi', locale: 'en-GH' }
};

// =====================================================
// PDF CONFIGURATION
// =====================================================
const PDF_CONFIG = {
  company: {
    name: process.env.COMPANY_NAME || "INFRASAP ACADEMY",
    tagline: "Enterprise Consulting & Professional Development",
    registrationNumber: "CRN-2024-001234",
    taxId: "GST-12AB-34CD-5678",
    website: "www.infrasap.com",
    email: "billing@infrasap.com",
    phone: "+234-800-000-0000"
  },
  address: {
    street: "Plot 234, Lekki-Epe Expressway",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    postalCode: "106104"
  },
  bank: {
    name: "First Bank of Nigeria",
    accountName: "INFRASAP ACADEMY LIMITED",
    accountNumber: "3123456789",
    bankCode: "011",
    swiftCode: "FBNGNGLA"
  },
  page: { width: 595, height: 842 },
  colors: {
    primary: rgb(0.05, 0.25, 0.55),
    secondary: rgb(0.1, 0.35, 0.7),
    accent: rgb(0.95, 0.55, 0.05),
    darkText: rgb(0.15, 0.15, 0.15),
    text: rgb(0.35, 0.35, 0.35),
    lightText: rgb(0.65, 0.65, 0.65),
    border: rgb(0.92, 0.92, 0.92),
    lightBg: rgb(0.97, 0.98, 0.99),
    white: rgb(1, 1, 1),
    success: rgb(0.18, 0.75, 0.45),
    warning: rgb(0.95, 0.6, 0.1),
    error: rgb(0.92, 0.22, 0.2)
  },
  fontSize: { h1: 24, h2: 18, h3: 14, h4: 12, body: 10, small: 9, tiny: 7 }
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function formatCurrency(amount, currencyCode = 'NGN') {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.NGN;
  return `${currency.symbol}${amount.toLocaleString(currency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function calculateTotal(quantity, unitPrice) {
  return quantity * unitPrice;
}

function truncateText(text, maxLen) {
  return text.length > maxLen ? text.slice(0, maxLen - 3) + "..." : text;
}

function drawFilledBox(page, x, y, width, height, fillColor, borderColor = null, borderWidth = 0) {
  if (fillColor) {
    page.drawRectangle({ x, y, width, height, color: fillColor });
  }
  if (borderColor) {
    page.drawRectangle({ x, y, width, height, borderColor, borderWidth });
  }
}

function drawLine(page, x1, y1, x2, y2, color = PDF_CONFIG.colors.border, thickness = 1) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
}

// =====================================================
// PDF GENERATION FUNCTIONS
// =====================================================
function drawPremiumHeader(page, font) {
  const { company, colors, fontSize, address } = PDF_CONFIG;

  drawFilledBox(page, 0, 820, 595, 22, colors.primary);

  page.drawText(company.name, { x: 50, y: 795, size: fontSize.h1, color: colors.primary, font });
  page.drawText(company.tagline, { x: 50, y: 777, size: fontSize.h4, color: colors.accent, font });

  const details = [
    `Reg: ${company.registrationNumber}`,
    `Tax: ${company.taxId}`,
    `Web: ${company.website}`
  ];

  let detailX = 50;
  details.forEach((detail) => {
    page.drawText(detail, { x: detailX, y: 763, size: fontSize.small, color: colors.lightText, font });
    detailX += 165;
  });

  page.drawText(`Tel: ${company.phone} | Email: ${company.email}`, {
    x: 50, y: 753, size: fontSize.small, color: colors.lightText, font
  });

  const fullAddress = `${address.street} | ${address.city}, ${address.state} | ${address.country}`;
  page.drawText(fullAddress, {
    x: 50, y: 743, size: fontSize.small, color: colors.lightText, font
  });

  drawLine(page, 50, 735, 545, 735, colors.accent, 2);
  return 730;
}

function drawInvoiceCard(page, font, startY, invoiceData) {
  const { colors, fontSize } = PDF_CONFIG;

  drawFilledBox(page, 50, startY - 60, 140, 60, colors.primary);
  page.drawText(invoiceData.documentType || "INVOICE", { x: 60, y: startY - 25, size: fontSize.h3, color: colors.white, font });
  page.drawText(invoiceData.invoiceNumber, { x: 60, y: startY - 45, size: fontSize.body, color: colors.accent, font });

  const statusColors = {
    DRAFT: colors.warning,
    UNPAID: colors.error,
    PAID: colors.success,
    PARTIALLY_PAID: colors.accent,
    CANCELLED: colors.text
  };

  drawFilledBox(page, 210, startY - 60, 140, 60, statusColors[invoiceData.status] || colors.warning);
  page.drawText("STATUS", { x: 220, y: startY - 25, size: fontSize.h3, color: colors.white, font });
  page.drawText(invoiceData.status, { x: 220, y: startY - 45, size: fontSize.body, color: colors.white, font });

  let infoY = startY - 15;
  [
    ["Invoice Date:", formatDate(invoiceData.invoiceDate)],
    ["Due Date:", formatDate(invoiceData.dueDate)],
    ["Reference:", invoiceData.referenceNumber || "N/A"]
  ].forEach(([label, value]) => {
    page.drawText(label, { x: 370, y: infoY, size: fontSize.small, color: colors.darkText, font });
    page.drawText(value, { x: 460, y: infoY, size: fontSize.small, color: colors.primary, font });
    infoY -= 14;
  });

  return startY - 75;
}

function drawBillingDetails(page, font, startY, invoiceData) {
  const { colors, fontSize } = PDF_CONFIG;
  const columnY = startY - 85;

  drawFilledBox(page, 50, columnY, 230, 85, colors.lightBg, colors.border, 1);
  page.drawText("BILL TO", { x: 60, y: columnY + 70, size: fontSize.h4, color: colors.primary, font });

  let billY = columnY + 55;
  page.drawText(invoiceData.billTo.companyName || invoiceData.billTo.name, { 
    x: 60, y: billY, size: fontSize.body, color: colors.darkText, font 
  });
  billY -= 12;

  [
    invoiceData.billTo.contactPerson,
    invoiceData.billTo.department,
    `${invoiceData.billTo.city}, ${invoiceData.billTo.state || invoiceData.billTo.country}`,
    invoiceData.billTo.email,
    invoiceData.billTo.phone
  ].filter(Boolean).forEach((detail) => {
    page.drawText(truncateText(detail, 35), { x: 60, y: billY, size: fontSize.small, color: colors.text, font });
    billY -= 10;
  });

  return columnY - 15;
}

function drawServicesTable(page, font, startY, services, currencyCode) {
  const { colors, fontSize } = PDF_CONFIG;
  const tableX = 50;
  const tableWidth = 490;
  const rowHeight = 18;
  const headerHeight = 22;
  let tableY = startY;

  drawFilledBox(page, tableX, tableY, tableWidth, headerHeight, colors.primary);
  page.drawText("SERVICE DESCRIPTION", { x: tableX + 8, y: tableY + 8, size: fontSize.small, color: colors.white, font });
  page.drawText("QTY", { x: tableX + 280, y: tableY + 8, size: fontSize.small, color: colors.white, font });
  page.drawText("UNIT PRICE", { x: tableX + 320, y: tableY + 8, size: fontSize.small, color: colors.white, font });
  page.drawText("AMOUNT", { x: tableX + 420, y: tableY + 8, size: fontSize.small, color: colors.white, font });

  tableY -= headerHeight;
  let totalAmount = 0, rowNum = 0;

  services.forEach((service) => {
    const lineTotal = calculateTotal(service.quantity, service.unitPrice);
    totalAmount += lineTotal;

    const bgColor = rowNum % 2 === 0 ? colors.lightBg : colors.white;
    drawFilledBox(page, tableX, tableY, tableWidth, rowHeight, bgColor, colors.border, 1);

    page.drawText(truncateText(service.description, 32), { 
      x: tableX + 8, y: tableY + 5, size: fontSize.small, color: colors.darkText, font 
    });
    page.drawText(`${service.quantity} ${service.unit || 'Unit'}`, { 
      x: tableX + 280, y: tableY + 5, size: fontSize.small, color: colors.text, font 
    });
    page.drawText(formatCurrency(service.unitPrice, currencyCode), { 
      x: tableX + 320, y: tableY + 5, size: fontSize.small, color: colors.text, font 
    });
    page.drawText(formatCurrency(lineTotal, currencyCode), { 
      x: tableX + 420, y: tableY + 5, size: fontSize.small, color: colors.primary, font 
    });

    tableY -= rowHeight;
    rowNum++;
  });

  return { tableY, totalAmount };
}

function drawFinancialSummary(page, font, startY, totalAmount, vatRate, currencyCode) {
  const { colors, fontSize } = PDF_CONFIG;
  const summaryX = 330;
  const summaryWidth = 210;
  const rowHeight = 16;
  let summaryY = startY;

  // Subtotal
  drawFilledBox(page, summaryX, summaryY, summaryWidth, rowHeight, colors.white, colors.border, 1);
  page.drawText("Subtotal", { x: summaryX + 10, y: summaryY + 4, size: fontSize.small, color: colors.text, font });
  page.drawText(formatCurrency(totalAmount, currencyCode), { 
    x: summaryX + 140, y: summaryY + 4, size: fontSize.small, color: colors.darkText, font 
  });
  summaryY -= rowHeight;

  // VAT
  const vatAmount = (totalAmount * vatRate) / 100;
  drawFilledBox(page, summaryX, summaryY, summaryWidth, rowHeight, colors.white, colors.border, 1);
  page.drawText(`VAT (${vatRate}%)`, { x: summaryX + 10, y: summaryY + 4, size: fontSize.small, color: colors.text, font });
  page.drawText(formatCurrency(vatAmount, currencyCode), { 
    x: summaryX + 140, y: summaryY + 4, size: fontSize.small, color: colors.darkText, font 
  });
  summaryY -= rowHeight;

  // Total Due
  const grandTotal = totalAmount + vatAmount;
  drawFilledBox(page, summaryX, summaryY - 2, summaryWidth, rowHeight + 6, colors.primary);
  page.drawText("TOTAL DUE", { x: summaryX + 10, y: summaryY, size: fontSize.h4, color: colors.white, font });
  page.drawText(formatCurrency(grandTotal, currencyCode), { 
    x: summaryX + 130, y: summaryY, size: fontSize.h4, color: colors.accent, font 
  });

  return { grandTotal, vatAmount, finalY: summaryY - 25 };
}

function drawPaymentInfo(page, font, startY) {
  const { colors, fontSize, bank } = PDF_CONFIG;

  drawFilledBox(page, 50, startY, 490, 55, colors.lightBg, colors.border, 1);
  page.drawText("BANK TRANSFER DETAILS", { x: 60, y: startY + 40, size: fontSize.h4, color: colors.primary, font });

  let bankY = startY + 26;
  [
    `Bank: ${bank.name} (${bank.bankCode})`,
    `Account Name: ${bank.accountName}`,
    `Account Number: ${bank.accountNumber} | SWIFT: ${bank.swiftCode}`
  ].forEach((detail) => {
    page.drawText(truncateText(detail, 70), { x: 60, y: bankY, size: fontSize.small, color: colors.text, font });
    bankY -= 11;
  });

  return startY - 65;
}

function drawPremiumFooter(page, font) {
  const { colors, fontSize, company } = PDF_CONFIG;

  drawFilledBox(page, 0, 0, 595, 50, colors.lightBg);
  drawLine(page, 40, 50, 555, 50, colors.primary, 2);

  page.drawText(`${company.name} | Registration: ${company.registrationNumber}`, { 
    x: 50, y: 32, size: fontSize.tiny, color: colors.darkText, font 
  });
  page.drawText(`${company.email} | ${company.phone}`, { 
    x: 50, y: 20, size: fontSize.tiny, color: colors.lightText, font 
  });
  page.drawText("Page 1 of 1", { x: 510, y: 32, size: fontSize.tiny, color: colors.lightText, font });
}

// Main PDF Generator
async function generateInvoicePDF(invoiceData) {
  try {
    console.log('\n📋 Generating PDF Invoice...');

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([PDF_CONFIG.page.width, PDF_CONFIG.page.height]);

    let yPos = drawPremiumHeader(page, font);
    yPos = drawInvoiceCard(page, font, yPos - 10, invoiceData);
    yPos = drawBillingDetails(page, font, yPos - 10, invoiceData);

    const { tableY, totalAmount } = drawServicesTable(page, font, yPos - 15, invoiceData.services, invoiceData.currency);
    const { grandTotal, vatAmount, finalY } = drawFinancialSummary(
      page, font, tableY - 8, totalAmount, invoiceData.vatRate || 7.5, invoiceData.currency
    );

    yPos = drawPaymentInfo(page, font, finalY - 15);
    drawPremiumFooter(page, font);

    const pdfBytes = await pdfDoc.save();

    console.log('✅ PDF Invoice generated successfully');
    console.log(`   Subtotal: ${formatCurrency(totalAmount, invoiceData.currency)}`);
    console.log(`   Total Due: ${formatCurrency(grandTotal, invoiceData.currency)}`);

    return pdfBytes;
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
}
const generateAdmissionEmail = (params) => {
    const {
      recipient_name = 'Prospective Student',
      course_name = 'Professional Training Program',
      start_date = 'To Be Announced',
      duration = '12 Weeks',
      admission_id = 'ADM-001',
      logo_url = 'https://infrasap.com/assets/logo.jpeg',
      signature_url = 'https://via.placeholder.com/160x60/ffffff/0078d4?text=Samantha',
      country = 'Global',
      company_registration = 'CRN-2024-001234'
    } = params;
  
    return `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Admission — InfraSAP</title>
  </head>
  <body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;color:#1c1c1e;">
  
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:40px 0;">
      <tr>
        <td align="center">
  
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" 
                 style="max-width:600px;background:#ffffff;border-radius:16px;padding:40px 32px;box-shadow:0 4px 30px rgba(0,0,0,0.05);">
  
            <tr>
              <td align="center" style="padding-bottom:30px;">
                <img src="${logo_url}" width="140" style="display:block;" alt="InfraSAP">
              </td>
            </tr>
  
            <tr>
              <td style="font-size:16px;line-height:1.55;color:#1c1c1e;padding-bottom:22px;">
                <p style="margin:0;">Dear <strong>${recipient_name}</strong>,</p>
                <p style="margin:18px 0 0 0;">
                  My name is <strong>Samantha</strong>, your assigned admissions agent at <strong>InfraSAP</strong>.
                  It brings me genuine joy to personally inform you that your application for the
                  <strong>${course_name}</strong> has been <strong>successfully approved</strong>.
                </p>
                <p style="margin:18px 0 0 0;">
                  This marks the beginning of an exciting journey. Below are your enrollment details.
                </p>
              </td>
            </tr>
  
            <tr>
              <td style="padding:0 0 30px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" 
                       style="background:#f7f7f7;border-radius:12px;padding:22px 20px;">
                  <tr><td style="padding:6px 0;font-size:15px;color:#1c1c1e;"><strong>Course:</strong> ${course_name}</td></tr>
                  <tr><td style="padding:6px 0;font-size:15px;color:#1c1c1e;"><strong>Start Date:</strong> ${start_date}</td></tr>
                  <tr><td style="padding:6px 0;font-size:15px;color:#1c1c1e;"><strong>Duration:</strong> ${duration}</td></tr>
                  <tr><td style="padding:6px 0;font-size:13px;color:#555;"><small>Admission ID: ${admission_id}</small></td></tr>
                </table>
              </td>
            </tr>
  
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#1c1c1e;padding-bottom:24px;">
                <p style="margin:0;">If you have any questions — whether about fees, timelines, or course structure — I am here to assist you directly.</p>
                <p style="margin:14px 0 0 0;">Welcome aboard!</p>
              </td>
            </tr>
  
            <tr>
              <td style="padding-bottom:40px;">
                <p style="margin:0;font-size:15px;color:#1c1c1e;">Warm regards,</p>
                <p style="margin:18px 0 0 0;font-size:15px;color:#1c1c1e;font-weight:600;">Samantha<br>
                <span style="font-weight:400;opacity:0.8;">Admissions Agent, InfraSAP</span></p>
  
                ${signature_url ? `<img src="https://img.freepik.com/premium-vector/fake-autograph-samples-handdrawn-signature_721791-5968.jpg?semt=ais_hybrid&w=740&q=80" alt="Signature" width="160" style="margin-top:10px;">` : ''}
              </td>
            </tr>
  
            <tr>
              <td style="font-size:12px;color:#999;text-align:center;line-height:1.5;padding-top:20px;border-top:1px solid #eee;">
                InfraSAP Academy • ${country}<br>
                Email: <a href="mailto:admissions@infrasap.com" style="color:#555;text-decoration:none;">admissions@infrasap.com</a><br>
                <span style="font-size:11px;">${company_registration}</span>
              </td>
            </tr>
  
          </table>
  
        </td>
      </tr>
    </table>
  
  </body>
  </html>
    `;
  };
  
  // =====================================================
  // ADD THIS ENDPOINT AFTER /api/invoice/update-status
  // (Around line 750, before /api/pdf/generate)
  // =====================================================
  
  // Send Admission Email (Protected)
  app.post('/api/email/admission', authenticateAdmin, async (req, res) => {
    try {
      const {
        to,
        recipient_name,
        course_name,
        start_date,
        duration,
        admission_id,
        logo_url = 'https://infrasap.com/assets/logo.jpeg',
        signature_url,
        country = 'Nigeria',
        company_registration = 'CRN-2024-001234',
        cc,
        bcc
      } = req.body;
  
      // Validation
      if (!to) {
        return res.status(400).json({ 
          success: false, 
          error: 'Recipient email (to) is required' 
        });
      }
  
      if (!recipient_name) {
        return res.status(400).json({ 
          success: false, 
          error: 'recipient_name is required' 
        });
      }
  
      if (!course_name) {
        return res.status(400).json({ 
          success: false, 
          error: 'course_name is required' 
        });
      }
  
      // Generate email HTML
      const htmlContent = generateAdmissionEmail({
        recipient_name,
        course_name,
        start_date: start_date || new Date().toLocaleDateString('en-US', { 
          year: 'numeric', month: 'long', day: 'numeric' 
        }),
        duration: duration || 'To be confirmed',
        admission_id: admission_id || `ADM-${Date.now()}`,
        logo_url,
        signature_url,
        country,
        company_registration
      });
  
      // Email options
      const mailOptions = {
        from: '"Samantha - InfraSAP Admissions" <no-reply@infrasap.com>',
        to: to,
        subject: `🎓 Welcome to ${course_name} - Your Admission Confirmation`,
        html: htmlContent,
        cc: cc,
        bcc: bcc
      };
  
      // Send email
      const info = await transporter.sendMail(mailOptions);
  
      console.log('✅ Admission email sent:', info.messageId);
  
      res.json({
        success: true,
        message: 'Admission email sent successfully',
        data: {
          messageId: info.messageId,
          recipient: to,
          admissionId: admission_id || `ADM-${Date.now()}`,
          courseName: course_name
        }
      });
  
    } catch (error) {
      console.error('❌ Error sending admission email:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
// =====================================================
// EMAIL TEMPLATES
// =====================================================
const generateInvoiceEmail = (params) => {
  const {
    recipient_name, course_name, invoice_number, total_amount, 
    currency, issue_date, status, logo_url
  } = params;

  const statusText = status === 'PAID' ? 'Payment Receipt' : 'Invoice';

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${statusText} — InfraSAP</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1c1e;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="max-width:600px;background:#ffffff;border-radius:16px;padding:40px 32px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="${logo_url}" width="120" alt="InfraSAP" style="display:block;">
            </td>
          </tr>

          <tr>
            <td style="font-size:16px;line-height:1.6;padding-bottom:24px;">
              <p style="margin:0;">Dear <strong>${recipient_name}</strong>,</p>
              <p style="margin:18px 0 0 0;">
                ${status === 'PAID' ? 
                  'Thank you for your payment! Your transaction has been successfully processed.' : 
                  `Your invoice for <strong>${course_name}</strong> is ready for review.`}
              </p>
              <p style="margin:18px 0 0 0;">
                Please find the detailed ${statusText.toLowerCase()} attached as a PDF.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding-bottom:32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                style="background:#f2f2f7;border-radius:12px;padding:20px;">
                <tr><td style="padding:6px 0;font-size:15px;"><strong>${statusText} Number:</strong> ${invoice_number}</td></tr>
                <tr><td style="padding:6px 0;font-size:15px;"><strong>Service:</strong> ${course_name}</td></tr>
                <tr><td style="padding:6px 0;font-size:15px;"><strong>Amount:</strong> ${total_amount} ${currency}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#666;"><small>Issued: ${issue_date}</small></td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="font-size:15px;line-height:1.6;padding-bottom:26px;color:#555;">
              ${status === 'PAID' ? 
                'This serves as your official payment receipt. Please retain this for your records.' :
                'Payment can be made via bank transfer. Details are provided in the attached invoice.'}
            </td>
          </tr>

          <tr>
            <td style="padding-bottom:30px;">
              <p style="margin:0;font-size:15px;">Best regards,</p>
              <p style="margin-top:16px;font-weight:600;font-size:15px;">InfraSAP Billing Team</p>
              <p style="margin:6px 0 0 0;font-size:14px;color:#888;">Enterprise Consulting & Professional Development</p>
            </td>
          </tr>

          <tr>
            <td align="center" style="font-size:12px;color:#999;line-height:1.5;padding-top:20px;border-top:1px solid #eee;">
              InfraSAP Academy | billing@infrasap.com<br>
              <span style="font-size:11px;">CRN-2024-001234</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// =====================================================
// API ENDPOINTS
// =====================================================

// Health Check (Public)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'InfraSap Production Invoice Service',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

// Get Supported Currencies (Public)
app.get('/api/currencies', (req, res) => {
  res.json({
    success: true,
    currencies: Object.keys(CURRENCIES).map(code => ({
      code,
      ...CURRENCIES[code]
    }))
  });
});

// Send Invoice Email with PDF (Protected)
app.post('/api/email/invoice', authenticateAdmin, async (req, res) => {
  try {
    const {
      // Required fields
      to,
      recipient_name,
      course_name,
      services,
      billTo,

      // Optional fields with defaults
      invoice_number,
      total_amount,
      currency = 'NGN',
      vatRate = 7.5,
      issue_date,
      dueDate,
      status = 'UNPAID',
      referenceNumber,
      logo_url = 'https://infrasap.com/assets/logo.jpeg',
      country = 'Nigeria',
      cc,
      bcc
    } = req.body;

    // Validation
    const errors = [];
    if (!to) errors.push('Recipient email (to) is required');
    if (!recipient_name) errors.push('recipient_name is required');
    if (!course_name) errors.push('course_name is required');
    if (!services || services.length === 0) errors.push('services array is required');
    if (!billTo || !billTo.companyName) errors.push('billTo.companyName is required');
    if (!billTo || !billTo.city) errors.push('billTo.city is required');
    if (!billTo || !billTo.country) errors.push('billTo.country is required');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    // Validate currency
    if (!CURRENCIES[currency]) {
      return res.status(400).json({
        success: false,
        error: `Invalid currency code. Supported: ${Object.keys(CURRENCIES).join(', ')}`
      });
    }

    // Calculate total if not provided
    let calculatedTotal = total_amount;
    if (!calculatedTotal) {
      const subtotal = services.reduce((sum, s) => sum + (s.quantity * s.unitPrice), 0);
      const vat = subtotal * (vatRate / 100);
      calculatedTotal = subtotal + vat;
    }

    // Prepare invoice data
    const invoiceData = {
      invoiceNumber: invoice_number || `INV-${Date.now()}`,
      invoiceDate: issue_date ? new Date(issue_date) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      referenceNumber: referenceNumber || `REF-${Date.now()}`,
      status: status,
      currency: currency,
      vatRate: vatRate,
      documentType: status === 'PAID' ? 'RECEIPT' : 'INVOICE',
      billTo: {
        companyName: billTo.companyName,
        contactPerson: billTo.contactPerson || recipient_name,
        department: billTo.department || '',
        street: billTo.street || '',
        city: billTo.city,
        state: billTo.state || '',
        country: billTo.country || country,
        postalCode: billTo.postalCode || '',
        email: billTo.email || to,
        phone: billTo.phone || '',
        taxId: billTo.taxId || ''
      },
      services: services
    };

    // Generate PDF
    const pdfBytes = await generateInvoicePDF(invoiceData);

    // Generate email HTML
    const htmlContent = generateInvoiceEmail({
      recipient_name,
      course_name,
      invoice_number: invoiceData.invoiceNumber,
      total_amount: formatCurrency(calculatedTotal, currency),
      currency,
      issue_date: invoiceData.invoiceDate.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      }),
      status: invoiceData.status,
      logo_url
    });

    // Email options
    const documentName = status === 'PAID' ? 'Receipt' : 'Invoice';
    const mailOptions = {
      from: '"InfraSAP Billing" <no-reply@infrasap.com>',
      to: to,
      subject: `${documentName} ${invoiceData.invoiceNumber} - ${course_name}`,
      html: htmlContent,
      cc: cc,
      bcc: bcc,
      attachments: [
        {
          filename: `${documentName}_${invoiceData.invoiceNumber}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: 'application/pdf'
        }
      ]
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ ${documentName} email with PDF sent:`, info.messageId);

    res.json({
      success: true,
      message: `${documentName} email sent successfully`,
      data: {
        messageId: info.messageId,
        recipient: to,
        invoiceNumber: invoiceData.invoiceNumber,
        documentType: documentName,
        status: invoiceData.status,
        currency: currency,
        amount: formatCurrency(calculatedTotal, currency),
        pdfGenerated: true
      }
    });

  } catch (error) {
    console.error('❌ Error sending invoice email:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update Invoice Status (Protected)
app.post('/api/invoice/update-status', authenticateAdmin, async (req, res) => {
  try {
    const {
      to,
      recipient_name,
      course_name,
      invoice_number,
      old_status,
      new_status,
      services,
      billTo,
      currency = 'NGN',
      vatRate = 7.5,
      payment_date,
      payment_method,
      transaction_reference
    } = req.body;

    // Validation
    if (!to || !invoice_number || !new_status) {
      return res.status(400).json({
        success: false,
        error: 'to, invoice_number, and new_status are required'
      });
    }

    // If status changed to PAID, send receipt
    if (new_status === 'PAID') {
      const subtotal = services.reduce((sum, s) => sum + (s.quantity * s.unitPrice), 0);
      const vat = subtotal * (vatRate / 100);
      const total = subtotal + vat;

      const receiptData = {
        invoiceNumber: invoice_number,
        invoiceDate: payment_date ? new Date(payment_date) : new Date(),
        dueDate: new Date(),
        referenceNumber: transaction_reference || `RCPT-${Date.now()}`,
        status: 'PAID',
        currency: currency,
        vatRate: vatRate,
        documentType: 'RECEIPT',
        billTo: billTo,
        services: services
      };

      const pdfBytes = await generateInvoicePDF(receiptData);

      const htmlContent = generateInvoiceEmail({
        recipient_name,
        course_name,
        invoice_number,
        total_amount: formatCurrency(total, currency),
        currency,
        issue_date: receiptData.invoiceDate.toLocaleDateString('en-US', { 
          year: 'numeric', month: 'long', day: 'numeric' 
        }),
        status: 'PAID',
        logo_url: 'https://infrasap.com/assets/logo.jpeg'
      });

      const mailOptions = {
        from: '"InfraSAP Billing" <no-reply@infrasap.com>',
        to: to,
        subject: `Payment Receipt ${invoice_number} - ${course_name}`,
        html: htmlContent,
        attachments: [
          {
            filename: `Receipt_${invoice_number}.pdf`,
            content: Buffer.from(pdfBytes),
            contentType: 'application/pdf'
          }
        ]
      };

      const info = await transporter.sendMail(mailOptions);

      console.log('✅ Payment receipt sent:', info.messageId);

      return res.json({
        success: true,
        message: 'Payment receipt sent successfully',
        data: {
          messageId: info.messageId,
          invoiceNumber: invoice_number,
          status: 'PAID',
          paymentDate: receiptData.invoiceDate
        }
      });
    }

    res.json({
      success: true,
      message: 'Status updated',
      data: {
        invoiceNumber: invoice_number,
        oldStatus: old_status,
        newStatus: new_status
      }
    });

  } catch (error) {
    console.error('❌ Error updating status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate PDF Only (Protected)
app.post('/api/pdf/generate', authenticateAdmin, async (req, res) => {
  try {
    const {
      invoice_number,
      services,
      billTo,
      currency = 'NGN',
      vatRate = 7.5,
      status = 'UNPAID'
    } = req.body;

    if (!services || services.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Services array is required' 
      });
    }

    const invoiceData = {
      invoiceNumber: invoice_number || `INV-${Date.now()}`,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      referenceNumber: `REF-${Date.now()}`,
      status: status,
      currency: currency,
      vatRate: vatRate,
      documentType: status === 'PAID' ? 'RECEIPT' : 'INVOICE',
      billTo: billTo || { companyName: 'N/A', city: 'N/A', country: 'N/A' },
      services: services
    };

    const pdfBytes = await generateInvoicePDF(invoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${invoiceData.invoiceNumber}.pdf`);
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 InfraSap Production Invoice Service v2.0            ║
║      Running on port ${PORT.toString().padEnd(4)}                               ║
║                                                          ║
║   🔒 Protected Endpoints (Require API Key):              ║
║   • POST /api/email/invoice                              ║
║   • POST /api/invoice/update-status                      ║
║   • POST /api/pdf/generate                               ║
║                                                          ║
║   🌐 Public Endpoints:                                   ║
║   • GET  /health                                         ║
║   • GET  /api/currencies                                 ║
║                                                          ║
║   ✨ Features:                                           ║
║   ✓ Multi-currency support (7 currencies)               ║
║   ✓ Admin API key authentication                        ║
║   ✓ Dynamic VAT calculation                             ║
║   ✓ Payment receipt generation                          ║
║   ✓ Professional PDF invoicing                          ║
║   ✓ Email with PDF attachments                          ║
║                                                          ║
║   🔑 API Key: Set ADMIN_API_KEY in .env                  ║
║      Header: X-API-Key: your_api_key                    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);

  console.log('\n📝 Default API Key:', process.env.ADMIN_API_KEY || 'infrasap_admin_2024_secure_key');
  console.log('⚠️  Change this in production by setting ADMIN_API_KEY in .env\n');
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});

module.exports = app;