const express = require("express");
const app = express();
const mysql = require("mysql");
const axios = require("axios");
const { exec } = require("child_process");
const port = 5000;

app.use(express.json());

var config = {
    user: "root", // Database username
    password: "12345", // Database password
    server: "localhost", // Server IP address
    database: "youtube", // Database name
    port: 3306, // Server port
    options: {
        encrypt: false, // Disable encryption
    },
};

const connection = mysql.createConnection(config);

connection.connect((err) => {
    if (err) {
        console.error("Database Connection Failed! Error: ", err);
        return;
    }
    console.log("Connection Successful!");
});
// Declare variables to store fetched data
let allVideos = [];
let allChannels = [];

// Function to fetch all channels
const fetchwholedatabase = () => {
    return new Promise((resolve, reject) => {
        const query =
            "SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where isShort = 0 order by upload_time desc limit 100";
        connection.query(query, (err, results) => {
            if (err) {
                reject(err);
            } else {
                allVideos = results;
                resolve();
            }
        });
    });
};

const fetchAllChannels = () => {
    return new Promise((resolve, reject) => {
        const query = "SELECT * FROM channels";
        connection.query(query, (err, results) => {
            if (err) {
                reject(err);
            } else {
                allChannels = results;
                resolve();
            }
        });
    });
};
// Fetch all data
const fetchAllData = async () => {
    try {
        await fetchAllChannels();
        await fetchwholedatabase();
    } catch (error) {
        console.error("Error fetching data:", error);
    }
};

fetchAllData();

app.get("/home", (req, res) => {
    const channel_id = req.query.channel_id;
    const query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where isShort = 0 order by upload_time desc limit 100`;
    connection.query(query, (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ page: "home", videos: results });
    });
});

app.get("/shorts", (req, res) => {
    const video_id = req.query.video_id;
    if (video_id) {
        const query = `(SELECT video_id FROM videos WHERE video_id = ?) UNION ALL (SELECT video_id FROM videos WHERE channel_id = (SELECT channel_id FROM videos WHERE video_id = ?) AND video_id != ? ORDER BY upload_time)`;
        connection.query(
            query,
            [video_id, video_id, video_id],
            (error, results) => {
                if (error) {
                    console.log(error);
                }
                res.status(200).json({ page: "shorts", shorts_vIds: results });
            }
        );
    } else {
        const query = `SELECT video_id FROM videos where isShort = 1 order by upload_time desc limit 100`;
        connection.query(query, (error, results) => {
            if (error) {
                console.log(error);
            }
            res.status(200).json({ page: "shorts", shorts_vIds: results });
        });
    }
});

app.get("/yourchannel", (req, res) => {
    const channel_id = req.query.channel_id;
    const query = `select * from channels where channel_id=?`;
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ page: "yourchannel", channel: results });
    });
});

app.get("/subscriptions", (req, res) => {
    const user_id = "UC0fcwXT_xgCBUuuczF-imLQ";
    const query = `select * from videos v inner join channels c on v.channel_id=c.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?)  order by upload_time desc limit 100`;

    connection.query(query, [user_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ page: "subscription", data: results });
    });
});

app.get("/watch", (req, res) => {
    const videoId = req.query.video_id;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;

    connection.query(query, [videoId], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json({ page: "watch", data: results });
    });
});

app.get("/channel", (req, res) => {
    const channel_id = req.query.channel_id;
    const query = `select * from channels where channel_id=?`;
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ page: "channel", channel: results });
    });
});

app.get("/category", (req, res) => {
    const category = req.query.category;
    const type = req.query.type;
    const caticon = {
        gaming: "https://yt3.googleusercontent.com/pzvUHajbQDLDt63gKFYUX445k3VprUs8CeJFpNTxGQZlk0grOSkAqU8Th1_C97dyYM3nENgjbw=s120-c-k-c0x00ffffff-no-rj",
        music: "https://yt3.googleusercontent.com/vCqmJ7cdUYpvR0bqLpWIe8ktaor4QafQLlfQyTuZy-M9W_YafT8Wo9kdsKL2St1BrkMRpVSJgA=s176-c-k-c0x00ffffff-no-rj-mo",
        movies: "https://www.gstatic.com/youtube/img/tvfilm/clapperboard_profile.png",
        news: "https://cdn-icons-png.flaticon.com/128/2964/2964063.png",
        sports: "https://yt3.googleusercontent.com/mUhuJiCiL8jf0Ngf9sh7BFBZCO0MUL2JyH_5ElHbV2fd13hxZ9zQ3-x-YePA_-PCUUH360G0=s176-c-k-c0x00ffffff-no-rj-mo",
        courses:
            "https://yt3.googleusercontent.com/WqGyfnVyCluIyyFDPdrHzqEfKQcTbtwhIJJ4Q_F3QGMqnYNs8aKswvDhzpY1q8vhS5g8Expi=s176-c-k-c0x00ffffff-no-rj-mo",
        fashionbeauty:
            "https://cdn-icons-png.flaticon.com/128/3211/3211391.png",
        shopping:
            "https://yt3.googleusercontent.com/4GiJyKFkqzoNzqSiNevXL8Q_yvba0TsD44t1qPGxPNc8Eic_GUa6diGWleJ2C7huhAW60MQYrA=s120-c-k-c0x00ffffff-no-rj-mo",
    };
    const categoryMapping = {
        gaming: ["Gaming"],
        music: ["Music"],
        movies: [
            "Film & Animation",
            "Short Movies",
            "Movies",
            "Anime/Animation",
            "Documentary",
            "Drama",
            "Sci-Fi/Fantasy",
            "Shows",
            "Trailers",
            "Thriller",
        ],
        news: ["News & Politics"],
        sports: ["Sports"],
        courses: [
            "Howto & Style",
            "Science & Technology",
            "Documentary",
            "Videoblogging",
        ],
        fashionbeauty: ["Pets & Animals", "Travel & Events"],
        shopping: ["Autos & Vehicles"],
    };
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.category in (?) and v.isShort = ? order by upload_time desc limit 100`;
    connection.query(
        query,
        [categoryMapping[category], type],
        (error, results) => {
            if (error) {
                console.log(error);
            }
            res.status(200).json({
                page: "category",
                caticon: caticon[category],
                videos: results,
                category: category,
            });
        }
    );
});

app.get("/search", (req, res) => {
    const query = req.query.query;
    const searchQuery = `%${query}%`;
    const q = `select * from channels c join videos v on c.channel_id=v.channel_id where v.title like ? or v.tags like ? or c.channel_name like ?  order by upload_time desc limit 100`;
    connection.query(
        q,
        [searchQuery, searchQuery, searchQuery],
        (error, results) => {
            if (error) {
                console.log(error);
            }
            res.status(200).json({
                page: "search",
                videos: results,
                query: query,
            });
        }
    );
});

app.get("/getvideobyid", (req, res) => {
    const video_id = req.query.video_id;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ video: results });
    });
});

app.get("/getvideosofchannel", (req, res) => {
    const channel_id = req.query.channel_id;
    const type = req.query.type;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.channel_id= ? and isShort= ? order by upload_time desc limit 100`;
    connection.query(query, [channel_id, type], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ videos: results });
    });
});

app.get("/getallchannels", (req, res) => {
    const query = `select channel_id from channels`;

    connection.query(query, (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json({ data: results });
    });
});

app.get("/get-subs/:user_id", (req, res) => {
    const user_id = req.params.user_id;
    let subs = [];
    const query = `SELECT * FROM subscriptions s join channels c where s.channel_id=c.channel_id and s.user_id= ?`;

    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ subscription: results });
    });
});

const ytdlpPath = "yt-dlp";

app.get("/get-stream-url", (req, res) => {
    const videoUrl = "https://www.youtube.com/watch?v=" + req.query.video_id;

    if (!videoUrl) {
        return res.status(400).send("Video URL is required");
    }

    const command = `${ytdlpPath} -f b --get-url ${videoUrl}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send("An error occurred");
        }

        if (stderr) {
            console.error(`stderr: ${stderr}`);
        }

        const streamUrl = stdout.trim();
        res.json({ streamUrl });
    });
});

app.listen(port, () => console.log(`listening on port ${port}!`));
