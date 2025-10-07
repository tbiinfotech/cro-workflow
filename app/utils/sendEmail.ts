import nodemailer from "nodemailer";

type MailOptions = {
  from: string;
  to: string;
  subject: string;
  html?: string;
};

// Create a transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "devmailsend4@gmail.com",
    pass: "gxtb bsjc vgqf vpwq",
  },
});

// Define the mail options
// const mailOptions = {
//   from: '"Your Name" <your_email@gmail.com>',
//   to: "recipient@example.com",
//   subject: "Test Email from Node.js (TypeScript)",
//   text: "Hello! This is a test email sent from Node.js using Nodemailer and TypeScript.",
//   // html: "<b>Hello! This is a test email sent from Node.js using Nodemailer and TypeScript.</b>"
// };

// Send the email
async function sendMail(mailOptions: MailOptions) {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.error("Error sendMail:", error);
  }
}

export default sendMail
