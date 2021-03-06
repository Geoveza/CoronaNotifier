require('dotenv').config()
const {
    readFile,
    writeFile,
    existsSync,
    readFileSync,
    unlink
} = require('fs')
const {
    Client,
    Location,
    MessageMedia
} = require('whatsapp-web.js')
const moment = require('moment-timezone')
const qrcode = require('qrcode-terminal')
const mqtt = require('mqtt')
const listen = mqtt.connect(process.env.MQTT_URL)
const User = require('./user/user.js')
const resChat = require('./chat')

const SESSION_FILE_PATH = './session.json'
let sessionCfg
if (existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH)
}

const client = new Client({
    puppeteer: {
        args: [
            '--headless',
            '--log-level=3', // fatal only
            '--start-maximized',
            '--no-default-browser-check',
            '--disable-infobars',
            '--disable-web-security',
            '--disable-site-isolation-trials',
            '--no-experiments',
            '--ignore-gpu-blacklist',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-default-apps',
            '--enable-features=NetworkService',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote'
        ]
    },
    session: sessionCfg
})
// You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.

client.initialize()

// ======================= Begin initialize WAbot

client.on('qr', (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    qrcode.generate(qr, {
        small: true
    })
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Please Scan QR with app!`)
})

client.on('authenticated', (session) => {
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Authenticated Success!`)
    // console.log(session);
    sessionCfg = session
    writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err)
        }
    })
})

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessfull
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] AUTHENTICATION FAILURE \n ${msg}`)
    unlink('./session.json', function (err) {
        if (err) return console.log(err)
        console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Session Deleted, Please Restart!`)
        process.exit(1)
    })
})

client.on('ready', () => {
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Whatsapp bot ready!`)
})

// ======================= Begin initialize mqtt broker

listen.on('connect', () => {
    listen.subscribe(process.env.MQTT_TOPIC, function (err) {
        if (!err) {
            console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Mqtt topic [${process.env.MQTT_TOPIC}] subscribed!`)
        }
    })
})

listen.on('message', (topic, message) => {
    // console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Message: ${message.toString()}`)
})
// ======================= WaBot Listen on Event

client.on('message_create', (msg) => {
    // Fired on all message creations, including your own
    if (msg.fromMe) {
        // do stuff here
    }
})

client.on('message_revoke_everyone', async (after, before) => {
    // Fired whenever a message is deleted by anyone (including you)
    // console.log(after); // message after it was deleted.
    if (before) {
        console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Revoked: ${before.body}`) // message before it was deleted.
    }
})

client.on('message_revoke_me', async (msg) => {
    // Fired whenever a message is only deleted in your own view.
    // console.log(msg.body); // message before it was deleted.
})

client.on('message_ack', (msg, ack) => {
    /*
          == ACK VALUES ==
          ACK_ERROR: -1
          ACK_PENDING: 0
          ACK_SERVER: 1
          ACK_DEVICE: 2
          ACK_READ: 3
          ACK_PLAYED: 4
      */

    if (ack == 3) {
        // The message was read
    }
})

client.on('group_join', (notification) => {
    // User has joined or been added to the group.
    console.log('join', notification)
    notification.reply('User joined.')
})

client.on('group_leave', (notification) => {
    // User has left or been kicked from the group.
    console.log('leave', notification)
    notification.reply('User left.')
})

client.on('group_update', (notification) => {
    // Group picture, subject or description has been updated.
    console.log('update', notification)
})

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason)
})

// ======================= WaBot Listen on message

client.on('message', async msg => {
    msg.body = msg.body.toLowerCase()
    msg.from.includes('@c.us') ? console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Message:`, msg.from.replace('@c.us', ''), `| ${msg.type}`, msg.body ? `| ${msg.body}` : '') : ''
    msg.from.includes('@g.us') ? console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Message:`, msg.from.replace('@g.us', ''), `| ${msg.type}`, msg.body ? `| ${msg.body}` : '') : ''

    if (msg.type == 'ciphertext' || msg.body == 'menu' || msg.body == 'info' || msg.body == 'corona' || msg.body == 'help' || msg.body == 'covid') {
        const chat = await msg.getChat()
        if (!chat.isGroup) {
            msg.reply('kirim !menu atau !help untuk melihat menu honk!.')
        }
    } else if (msg.body == 'halo' || msg.body == 'hai' || msg.body == 'hallo' || msg.body == 'woi') {
        const chat = await msg.getChat()
        if (!chat.isGroup) {
            msg.reply('hi 😃')
        }
    } else if (msg.body == '!msg') {
        var kontak = await await msg.getContact()
        console.log(kontak)
        console.log(msg)
    } else if (msg.body == '!ping' || msg.body == 'ping' || msg.body == 'p') {
        client.sendMessage(msg.from, 'pong')
    } else if (msg.body == '!honk' || msg.body == 'honk!' || msg.body == 'honk') {
        client.sendMessage(msg.from, 'Honk Honk!!')
    } else if (msg.body.startsWith('!sendto ')) {
        let number = msg.body.split(' ')[1]
        const messageIndex = msg.body.indexOf(number) + number.length
        const message = msg.body.slice(messageIndex, msg.body.length)
        if (number.includes('@g.us')) {
            const group = await client.getChatById(number)
            group.sendMessage(message)
        } else if (!number.includes('@c.us') && !number.includes('@g.us')) {
            number = number.includes('@c.us') ? number : `${number}@c.us`
            const chat = await msg.getChat()
            chat.sendSeen()
            client.sendMessage(number, message)
        }
    } else if (msg.body == '!chats') {
        const chats = await client.getChats()
        const group = chats.filter(x => x.isGroup == true)
        const personalChat = chats.filter(x => x.isGroup == false)
        readFile('./user/user.json', 'utf-8', function (err, data) {
            if (err) throw err
            const userData = JSON.parse(data)
            client.sendMessage(msg.from, `The bot has...
Chats open: ${chats.length} 
Groups chats: ${group.length}
Personal chats: ${personalChat.length}
Notification User: ${userData.length}`)
        })
    } else if (msg.body == '!help' || msg.body == '!menu') {
        const contact = await msg.getContact()
        const nama = contact.pushname !== undefined ? `Hai, ${contact.pushname} 😃` : 'Hai 😃'
        client.sendMessage(msg.from, `
${nama}
kenalin aku Honk! 🤖 robot yang akan memberitahumu informasi mengenai COVID-19 di Indonesia. 

*DAFTAR PERINTAH*
!menu / !help  =>  Menampilkan menu
!ping  =>  pong

*COVID-19* 
!corona  =>  Menu COVID-19 Indonesia

*NOTIFIKASI*
!aktif  =>  Mengaktifkan notifikasi
!mati  =>  Mematikan notifikasi

*LAIN-LAIN*
!data => Daftar Web informasi COVID-19 Indonesia
!peta => Daftar Peta Sebaran COVID-19 per-Prov
!sumber => Sumber data Honk!

*DONASI*
!donasi => Mari berdonasi bersama SGB X GRAISENA LAWAN COVID-19.


Made with ♥️ by Yoga Sakti`)
    } else if (msg.body == '!donasi') {
        const logoDonasi = new MessageMedia('image/png', readFileSync('./Donasi-1.jpg', 'base64'))
        client.sendMessage(msg.from, logoDonasi, { caption: await resChat.Donasi() })
        const infoRek = new MessageMedia('image/png', readFileSync('./Donasi-2.jpg', 'base64'))
    // delay ini menanggulangi jika terjadi delay ketika mengirim gambar pertama
    setTimeout(function () { client.sendMessage(msg.from, infoRek) }, 500)
    } else if (msg.body == '!sumber') {
        client.sendMessage(msg.from, await resChat.SumberData())
    } else if (msg.body == '!peta') {
        client.sendMessage(msg.from, await resChat.PetaProv())
    } else if (msg.body == '!data') {
        client.sendMessage(msg.from, await resChat.DataNasional())
    } else if (msg.body == '!bandung') {
        client.sendMessage(msg.from, await resChat.Bandung())
    } else if (msg.body == '!bekasi') {
        client.sendMessage(msg.from, await resChat.Bekasi())
    } else if (msg.body == '!nasional') {
        client.sendMessage(msg.from, await resChat.Nasional())
    } else if (msg.body == '!global') {
        client.sendMessage(msg.from, await resChat.Global())
    } else if (msg.body == '!jabar') {
        client.sendMessage(msg.from, await resChat.Jabar())
    } else if (msg.body == '!wisma-atlit') {
        client.sendMessage(msg.from, await resChat.WismaAtlit())
    } else if (msg.body == '!aktif' || msg.body === '!daftar') {
        const chat = await msg.getChat()
        if (chat.isGroup) {
            msg.reply('Maaf, perintah ini tidak bisa digunakan di dalam grup! silahkan kirim !aktif di personal chat untuk mengaktifkan notifikasi.')
        } else {
            User.addUser(msg.from)
                .then(result => {
                    if (!result) {
                        client.sendMessage(msg.from,
                            'Notifikasi sudah aktif.'
                        )
                    } else {
                        client.sendMessage(msg.from,
                            'Berhasil mengaktifkan notifikasi, anda akan mendapat notifikasi ketika ada permbaruan data.'
                        )
                    }
                })
        }
    } else if (msg.body == '!mati') {
        const chat = await msg.getChat()
        if (chat.isGroup) {
            msg.reply('Maaf, perintah ini tidak bisa digunakan di dalam grup! silahkan kirim !aktif di personal chat untuk mengaktifkan notifikasi.')
        } else {
            User.checkUser(msg.from).then(result => {
                if (result) {
                    User.removeUser(msg.from)
                        .then(result => {
                            if (result) {
                                client.sendMessage(msg.from,
                                    'Berhasil menonaktifkan, anda tidak akan mendapat notifikasi lagi.'
                                )
                            } else {
                                client.sendMessage(msg.from,
                                    'Gagal menonaktifkan, nomor tidak terdaftar.'
                                )
                            }
                        })
                } else {
                    client.sendMessage(msg.from,
                        'Gagal menonaktifkan, nomor tidak terdaftar.'
                    )
                }
            })
        }
    } else if (msg.body == '!corona' || msg.body === '!covid' || msg.body === '!covid19' || msg.body === '!covid-19') {
            client.sendMessage(msg.from, `
*Menu COVID-19*
!nasional  =>  Data COVID-19 Nasional
!global => Data COVID-19 Global

*Provinsi*
!jabar => Data COVID-19 Prov Jawa Barat

*Kota*
!bandung => Data COVID-19 Kota Bandung
!bekasi = Data COVID-19 Kota Bekasi

*Rumah Sakit*
!wisma-atlit => Data RS Darurat Wisma Atlit

_*seluruh data yang ada adalah data terbaru._
Made with ♥️ by Yoga Sakti`)
        // ============================================= Groups
    } else if (msg.body == '!leave') { // && msg.from == `${process.env.ADMIN_NUMBER}@c.us`
        const chat = await msg.getChat()
        if (chat.isGroup) {
            chat.leave()
        } else {
            msg.reply('This command can only be used in a group!')
        }
        // Leave from all group
        // const chats = await client.getChats()
        // var search = chats.filter(x => x.isGroup == true)
        // var except = search.filter(x => x.id._serialized !== 'ID')
        // msg.reply(`Request diterima bot akan keluar dari ${except.length} grup.`)
        // for (var i = 0; i < except.length; i++) {
        //     console.log(`Keluar dari Grup: ${except[i].name}`)
        //     except[i].leave()
        // }
    } else if (msg.body.startsWith('!join ') && msg.fromMe) {
        const inviteCode = msg.body.split(' ')[1]
        try {
            await client.acceptInvite(inviteCode)
            msg.reply('Joined the group!')
        } catch (e) {
            msg.reply('That invite code seems to be invalid.')
        }
    } else if (msg.body == '!broadcast') { // && msg.from == `${process.env.ADMIN_NUMBER}@c.us`
        readFile('./user/user.json', 'utf-8', function (err, data) {
            if (err) throw err
            const userData = JSON.parse(data)
            for (var i = 0; i < userData.length; i++) {
                const number = userData[i].user
                setTimeout(async function () {
                    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Send Broadcast to ${number}`)
                    client.sendMessage(number, await resChat.Broadcast())
                }, i * 2000) // Delay 2 Sec
            }
        })
    }
})

listen.on('message', (topic, message) => {
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] MQTT: ${message.toString()}`)
    readFile('./user/user.json', 'utf-8', function (err, data) {
        if (err) throw err
        const userData = JSON.parse(data)
        for (var i = 0; i < userData.length; i++) {
            const number = userData[i].user
            // number = number.includes('@c.us') ? number : `${number}@c.us`;
            setTimeout(function () {
                console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Send Corona Update to${number}`)
                if (message.toString() == 'New Update!') {
                    readFile('./CoronaService/data.json', 'utf-8', function (err, data) {
                        if (err) throw err
                        const localData = JSON.parse(data)
                        client.sendMessage(number, `
*COVID-19 Update!!*
Negara: ${localData.Country}
Hari Ke: ${localData.Day}

Total Kasus: ${localData.TotalCases}
*Kasus Baru: ${localData.NewCases}*

Pasien Dirawat: ${localData.ActiveCases}
*Dirawat Baru: ${localData.NewActiveCases}*

Pasien Sembuh: ${localData.TotalRecovered}
*Sembuh Baru: ${localData.NewRecovered}*
Presentase Sembuh: ${localData.PresentaseRecovered}

Pasien Meninggal: ${localData.TotalDeaths}
*Meninggal Baru: ${localData.NewDeaths}*
Presentase Meninggal: ${localData.PresentaseDeath}
                    
Di Perbarui Pada: 
${localData.lastUpdate}
Sumber: 
_https://www.covid19.go.id_
                    `)
                    })
                }
                // Delay 2 Sec
            }, i * 1500)
        }
    })
})
