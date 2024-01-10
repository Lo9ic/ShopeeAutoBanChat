const axios = require('axios');
const fs = require('fs');


function readCookiesFromFile(filePath) {
  try {
    const cookies = fs.readFileSync(filePath, 'utf8');
    return cookies.trim();
  } catch (error) {
    console.error('Error reading cookies from file:', error.message);
    return null;
  }
}

function readBannedWordsFromFile(filePath) {
  try {
    const bannedWords = fs.readFileSync(filePath, 'utf8').split('\n').map(word => word.trim());
    return bannedWords;
  } catch (error) {
    console.error('Error reading banned words from file:', error.message);
    return [];
  }
}

const cookiesFilePath = 'cookies.txt';

const banwordFilePath = 'banword.txt';

const cookies = readCookiesFromFile(cookiesFilePath);

if (!cookies) {
  console.error('Cookies not available. Please check your cookies.txt file.');
  process.exit(1);
}

const bannedWords = readBannedWordsFromFile(banwordFilePath);

let sessionId = null;
let chatroomId = null;
let deviceId = null;

let bannedUsers = [];

function getSessionId() {
    const sessionUrl = 'https://live.shopee.co.id/webapi/v1/session';
  
    axios.get(sessionUrl, {
        headers: {
          'Cookie': cookies,
        }
      })
      .then(response => {
        const sessionData = response.data;
  
        if (sessionData && sessionData.err_code === 0 && sessionData.data && sessionData.data.session) {
          sessionId = sessionData.data.session.session_id;
          chatroomId = sessionData.data.session.chatroom_id;
          deviceId = sessionData.data.session.device_id;
  
          console.log('Session ID:', sessionId);
          console.log('Chatroom ID:', chatroomId);
          console.log('Device ID:', deviceId);
  
          checkMessage();
        } else {
          console.log('Error getting session ID:', sessionData.err_msg);
        }
      })
      .catch(error => {
        console.error('Error getting session ID:', error.message);
      });
  }

function containsBannedWords(content) {
    const lowerContent = content.toLowerCase();
    return bannedWords.some(word => lowerContent.includes(word.toLowerCase()));
  }

function banUser(uid) {
  const banUrl = `https://live.shopee.co.id/webapi/v1/session/${sessionId}/comment/ban`;

  const postData = {
    is_ban: true,
    ban_uid: uid
  };

  axios.post(banUrl, postData, {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
      }
    })
    .then(response => {
      console.log('User banned successfully:', response.data);
    })
    .catch(error => {
      console.error('Error banning user:', error.message);
    });
}

function checkMessage() {
  const apiUrl = `https://chatroom-live.shopee.co.id/api/v1/fetch/chatroom/${chatroomId}/message?uuid=${deviceId}`;

  axios.get(apiUrl, {
    headers: {
      'Cookie': cookies,
    }
  })
  .then(response => {
    const jsonData = response.data;

    if (jsonData && jsonData.data && jsonData.data.message && jsonData.data.message.length > 0) {
      const message = jsonData.data.message[0];

      if (message.msgs && message.msgs.length > 0) {
        message.msgs.forEach(msg => {
          if (msg.content) {
            const content = JSON.parse(msg.content);

            if (content && content.content) {
              const messageContent = content.content;

              if (containsBannedWords(messageContent)) {
                console.log('Message contains banned words. UID:', msg.uid);

                if (!bannedUsers.includes(msg.uid)) {
                  banUser(msg.uid);
                  bannedUsers.push(msg.uid);
                } else {
                  console.log('User already banned. Skipping.');
                }
              } else {
                console.log('Message does not contain banned words:', messageContent);
              }
            }
          }
        });
      }
    }
  })
  .catch(error => {
    console.error('Error making request:', error.message);
  });
}

getSessionId();

setInterval(() => {
  checkMessage();
}, 2000);
