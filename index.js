const express = require("express");
const serverless = require("serverless-http");
const app = express();
const cors = require("cors");
const nodemailer = require("nodemailer");
const bodyparser = require("body-parser");
const dotenv = require("dotenv").config();

const { CLIENT_URLS, EMAIL_PASS, EMAIL_USER, EMAIL_REPORT } = process.env;

const whitelist = CLIENT_URLS ? CLIENT_URLS.split(",") : [];

app.use(express.json());
app.use(bodyparser.json());
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (whitelist.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  })
);

const emailStyles =
  "<style>.ltr{text-align:left;}.rtl{text-align:right;}.editor-text-bold{font-weight:bold;}.editor-text-italic{font-style:italic;}.editor-text-underline{text-decoration:underline;}.editor-text-strikethrough{text-decoration:line-through;}.editor-text-underlineStrikethrough{text-decoration:underlineline-through;}.editor-text-code{background-color:#ccc;padding:1px0.25rem;font-family:Menlo,Consolas,Monaco,monospace;font-size:94%;}.editor-link{color:rgb(33,111,219);text-decoration:none;}.editor-code{background-color:#ccc;font-family:Menlo,Consolas,Monaco,monospace;display:block;padding:8px 8px 8px 52px;line-height:1.53;font-size:13px;margin:0;margin-top:8px;margin-bottom:8px;tab-size:2;overflow-x:auto;position:relative;}.editor-code:before{content:attr(data-gutter);position:absolute;background-color:#ddd;left:0;top:0;border-right:1px solid #ccc;padding:8px;color:#777;white-space:pre-wrap;text-align:right;min-width:25px;}.editor-code:after{content:attr(data-highlight-language);top:0;right:3px;padding:3px;font-size:10px;text-transform:uppercase;position:absolute;color: #000;}.editor-tokenComment{color:slategray;}.editor-tokenPunctuation{color:#999;}.editor-tokenProperty{color:#905;}.editor-tokenSelector{color:#690;}.editor-tokenOperator{color:#9a6e3a;}.editor-tokenAttr{color:#07a;}.editor-tokenVariable{color:#e90;}.editor-tokenFunction{color:#dd4a68;}.editor-paragraph{margin:0;margin-bottom:8px;position:relative;}.editor-paragraph:last-child{margin-bottom:0;}.editor-heading-h1{font-size:24px;margin:0;margin-bottom:12px;padding:0;}.editor-heading-h2{font-size:16px;margin:0;margin-top:10px;padding:0;}.editor-quote{margin:0;margin-left:20px;font-size:15px;color:rgb(101,103,107);border-left-color:rgb(206,208,212);border-left-width:4px;border-left-style:solid;padding-left:16px;}.editor-list-ol{padding:0;margin:0;margin-left:16px;list-style-type:decimal;}.editor-list-ul{list-style-type:circle;padding:0;margin:0;margin-left:16px;}.editor-listitem{margin:8px 32px 8px 32px;}.editor-nested-listitem{list-style-type:none;}</style>";

let transporter = nodemailer.createTransport({
  host: "smtp-mail.outlook.com",
  service: "outlook",
  secureConnection: false,
  tls: {
    ciphers: "SSLv3",
  },
  port: 587,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

const sendEmail = async (subject, message, to, from, attachments = []) => {
  const options = {
    from: from,
    to: to,
    subject: subject,
    html: message,
    attachments: attachments,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(options, (err, info) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        resolve(info);
      }
    });
  });
};

app.post("/send_email", async (req, res) => {
  const { 
    subject = "DrawDB Feedback Submission",
    message, 
    attachments = [],
    // Extract form fields that might be present
    satisfaction,
    easeOfUse,
    likelihood,
    difficulties,
    triedSimilarApps,
    occupation,
    feedbackText
  } = req.body;

  try {
    // Construct a more structured email from form fields if available
    let emailContent = message;
    
    // If no message is provided but we have form fields, create a structured message
    if (!message && (satisfaction || easeOfUse || likelihood)) {
      emailContent = `
        <h2>DrawDB Feedback Submission</h2>
        
        ${satisfaction ? `<p><strong>Satisfaction Rating:</strong> ${satisfaction}/100</p>` : ''}
        ${easeOfUse ? `<p><strong>Ease of Use Rating:</strong> ${easeOfUse}/100</p>` : ''}
        ${likelihood ? `<p><strong>Likelihood to Recommend:</strong> ${likelihood}/100</p>` : ''}
        ${difficulties !== undefined ? `<p><strong>Encountered Difficulties:</strong> ${difficulties ? 'Yes' : 'No'}</p>` : ''}
        ${triedSimilarApps !== undefined ? `<p><strong>Tried Similar Apps:</strong> ${triedSimilarApps ? 'Yes' : 'No'}</p>` : ''}
        ${occupation ? `<p><strong>Occupation:</strong> ${occupation}</p>` : ''}
        
        ${feedbackText ? `<h3>Feedback:</h3><div>${feedbackText}</div>` : ''}
        
        <p><em>Submitted on: ${new Date().toISOString()}</em></p>
      `;
    }

    await sendEmail(
      subject,
      `<html><head>${emailStyles}</head><body>${emailContent}</body></html>`,
      EMAIL_REPORT,
      EMAIL_USER,
      attachments
    );
    
    res.status(200).json({ message: "Thank you for your feedback!" });
  } catch (e) {
    console.error("Error sending email:", e);
    res.status(500).json({ error: "There was a problem submitting your feedback. Please try again later." });
  }
});

// Health check endpoint for API Gateway
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// If running in local environment
if (process.env.NODE_ENV === 'development') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

// Export for Lambda
module.exports.handler = serverless(app);
