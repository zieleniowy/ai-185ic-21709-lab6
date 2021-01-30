const nodemailer = require('nodemailer')

let transporter = nodemailer.createTransport({
  host: process.env.MAIL_SMTP_SERVER,
  port: process.env.MAIL_SMTP_PORT*1,
  secure: true, // upgrade later with STARTTLS
  auth: {
    user: process.env.MAIL_AUTH_USER,
    pass: process.env.MAIL_AUTH_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function send(subject, content, to){
  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: process.env.MAIL_FROM, // sender address
    to: typeof to==="string"?to:to.join(','), // list of receivers
    subject, // Subject line
    html: content, // html body
  });
}

module.exports = send;