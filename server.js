const express = require("express");
const path = require("path");
const app = express();
const mysql = require("mysql2");
require("dotenv").config();
const { exec } = require("child_process");
const port = process.env.PORT;
const cors = require("cors");

app.use(express.json());
app.use(cors());
var config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
};

const connection = mysql.createConnection(config);

connection.connect((err) => {
    if (err) {
        console.error("Database Connection Failed! Error: ", err);
        return;
    }
    console.log("Database Connection Successful!");
});

// Functions
const { v4: uuidv4 } = require("uuid");

function generateBase64Uuid(extraInput) {
    const uuid = uuidv4();
    const uuidWithoutHyphens = uuid.replace(/-/g, "");
    const buffer = Buffer.from(uuidWithoutHyphens + extraInput, "hex");
    const base64Id = buffer.toString("base64");
    const urlSafeBase64Id = base64Id
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return urlSafeBase64Id;
}

function generateChannelId(userId) {
    const timestamp = Date.now().toString(16);
    const base64Id = generateBase64Uuid(userId + timestamp);
    return `UC${base64Id.substring(0, 22)}`;
}

function generateVideoId(userId) {
    const uuid = uuidv4().replace(/-/g, "").substring(0, 12);
    const extraInput = userId + Date.now().toString(16);
    const buffer = Buffer.from(uuid + extraInput, "hex");
    const base64Id = buffer.toString("base64");
    const urlSafeBase64Id = base64Id
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return urlSafeBase64Id;
}

app.get("/home", (req, res) => {
    const page_no = req.query.page;
    const query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where isShort = 0 order by rand() desc limit 24 offset ?`;
    connection.query(query, [24 * (page_no - 1)], (error, results) => {
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
    const user_id = req.query.user_id;
    const isShort = req.query.isShort;
    const query = `select * from videos v inner join channels c on v.channel_id=c.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?) and v.isShort=? order by upload_time desc limit 100`;

    connection.query(query, [user_id, isShort], (error, results) => {
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
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.category in (?) and v.isShort = ? order by rand() desc limit 100`;
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

app.get("/likedvideos", (req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.* FROM likedvideos lv JOIN videos v ON lv.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE lv.user_id = ? order by liked_time desc limit 100`;
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({
            page: "likedvideos",
            videos: results,
        });
    });
});

app.get("/watchlater", (req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.* FROM watchlater lv JOIN videos v ON lv.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE lv.user_id = ? order by added_time desc limit 100`;
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({
            page: "watchlater",
            videos: results,
        });
    });
});

app.get("/login", async (req, res) => {
    const username = req.query.username;
    const email = req.query.email;
    const hashpass = req.query.hashpass;
    const query = `select * from channels c join user u on u.channel_id=c.channel_id where (u.email=? or u.user_id=?) and u.pass=?`;
    connection.query(query, [email, username, hashpass], (error, results) => {
        if (error) {
            console.log("User Not Found: " + error);
        }
        res.status(200).json({ user: results[0] });
    });
});

app.post("/register", (req, res) => {
    const values = {
        fname: req.body.fnamefix,
        lname: req.body.lnamefix,
        username: req.body.username,
        email: req.body.email,
        hashpass: req.body.hashpass,
        DOB: req.body.DOB,
        chl_name: req.body.chl_namefix,
        chl_desc: req.body.chl_descfix,
        channel_id: generateChannelId(req.body.username),
        custom_url: "@" + req.body.username,
        location: req.body.location,
    };
    const channelQuery = `INSERT INTO channels (channel_id, channel_name, short_desc, custom_url, location) VALUES (?, ?, ?, ?, ?)`;
    connection.query(
        channelQuery,
        [
            values.channel_id,
            values.chl_name,
            values.chl_desc,
            values.custom_url,
            values.location,
        ],
        (error, results) => {
            if (error) {
                console.log("Error creating channel: ", error);
                return res
                    .status(500)
                    .json({ error: "Failed to create channel" });
            }
            const userQuery = `INSERT INTO user (user_id, username, email, pass, DOB, channel_id) 
                                VALUES (?, ?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), username = VALUES(user_id),email = VALUES(email),DOB=VALUES(DOB),channel_id=VALUES(channel_id)`;
            connection.query(
                userQuery,
                [
                    values.username,
                    values.fname + " " + values.lname,
                    values.email,
                    values.hashpass,
                    values.DOB,
                    values.channel_id,
                ],
                (error, results) => {
                    if (error) {
                        console.log("Error registering user: ", error);
                        return res
                            .status(500)
                            .json({ error: "Failed to register user" });
                    }

                    return res
                        .status(200)
                        .json({ message: "Registration successful" });
                }
            );
        }
    );
});

app.get("/getvideobyid", (req, res) => {
    const video_id = req.query.video_id;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.log("Getvideobyid: " + error);
        }
        res.status(200).json({ video: results });
    });
});

app.get("/getvideosofchannel", (req, res) => {
    const channel_id = req.query.channel_id;
    const searchTerm = req.query.query || ""; // default to empty string if query is not provided
    const type = req.query.type;
    const formattedSearchTerm = `%${searchTerm}%`; // Add wildcards

    let query;
    if (searchTerm === "") {
        query = `SELECT * FROM videos v 
                 JOIN channels c ON v.channel_id = c.channel_id 
                 WHERE v.channel_id = ? AND v.isShort = ? 
                 ORDER BY upload_time DESC 
                 LIMIT 100`;

        connection.query(query, [channel_id, type], (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Database query failed" });
            }
            res.status(200).json({ videos: results });
        });
    } else {
        query = `SELECT * FROM videos v 
                 JOIN channels c ON v.channel_id = c.channel_id 
                 WHERE v.channel_id = ? AND v.isShort = ? 
                 AND (v.title LIKE ?) 
                 ORDER BY upload_time DESC 
                 LIMIT 100`;

        connection.query(
            query,
            [channel_id, type, formattedSearchTerm],
            (error, results) => {
                if (error) {
                    console.error(error);
                    return res
                        .status(500)
                        .json({ error: "Database query failed" });
                }

                res.status(200).json({ videos: results });
            }
        );
    }
});

// Subscriptions
app.post("/addtosubs", (req, res) => {
    const user_chl_id = req.body.user_chl_id;
    const channel_id = req.body.channel_id;
    const query = `INSERT INTO subscriptions (user_id,channel_id) VALUES (?, ?)`;

    connection.query(query, [user_chl_id, channel_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json({
            success: true,
            comment: "Subcriber added success",
        });
    });
});

app.post("/removefromsubs", (req, res) => {
    const user_chl_id = req.body.user_chl_id;
    const channel_id = req.body.channel_id;

    if (!user_chl_id || !channel_id) {
        return res
            .status(400)
            .json({ error: "user_chl_id and channel_id are required" });
    }

    const query = `DELETE FROM subscriptions WHERE user_id = ? AND channel_id = ?`;

    connection.query(query, [user_chl_id, channel_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "Subscription not found" });
        }

        res.status(200).json({
            success: true,
            comment: "Subscription removed successfully",
        });
    });
});

app.get("/issub", (req, res) => {
    const user_chl = req.query.user_id;
    const channel_id = req.query.channel_id;

    if (!user_chl || !channel_id) {
        return res
            .status(400)
            .json({ error: "user_id and channel_id are required" });
    }

    const query = `SELECT * FROM subscriptions WHERE user_id = ? AND channel_id = ?`;
    connection.query(query, [user_chl, channel_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: "Database query error" });
        }
        if (results.length > 0) {
            return res.status(200).json({ sub: true });
        } else {
            return res.status(200).json({ sub: false });
        }
    });
});

// Likes
app.post("/addtoliked", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `INSERT INTO likedvideos (user_id, video_id) VALUES (?, ?)`;

    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json({
            success: true,
            comment: "Video liked successfully",
        });
    });
});

app.post("/removefromliked", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `DELETE FROM likedvideos WHERE user_id = ? AND video_id = ?`;

    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "Like not found" });
        }

        res.status(200).json({
            success: true,
            comment: "Like removed successfully",
        });
    });
});

app.get("/isliked", (req, res) => {
    const user_id = req.query.user_id;
    const video_id = req.query.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `SELECT * FROM likedvideos WHERE user_id = ? AND video_id = ?`;

    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.length > 0) {
            return res.status(200).json({ liked: true });
        } else {
            return res.status(200).json({ liked: false });
        }
    });
});

// History

app.post("/addtohistory", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `INSERT INTO history (user_id, video_id, watched_time) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE watched_time = CURRENT_TIMESTAMP`;
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json({
            success: true,
            comment: "Video added to history successfully",
        });
    });
});

app.post("/removefromhistory", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `DELETE FROM history WHERE user_id = ? AND video_id = ?`;

    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "History not found" });
        }

        res.status(200).json({
            success: true,
            comment: "History removed successfully",
        });
    });
});

app.get("/history", (req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.*,h.watched_time FROM history h JOIN videos v ON h.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE h.user_id = ? ORDER BY h.watched_time DESC LIMIT 100`;
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json({ videos: results });
    });
});

// Watch Later

// Likes
app.post("/addtowatchlater", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `INSERT INTO watchlater (user_id, video_id,added_time) VALUES (?, ?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE added_time = CURRENT_TIMESTAMP`;

    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json({
            success: true,
            comment: "watchlater added successfully",
        });
    });
});

app.post("/removefromwatchlater", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `DELETE FROM watchlater WHERE user_id = ? AND video_id = ?`;

    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "watchlater not found" });
        }

        res.status(200).json({
            success: true,
            comment: "watchlater removed successfully",
        });
    });
});

app.get("/iswatchlater", (req, res) => {
    const user_id = req.query.user_id;
    const video_id = req.query.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `SELECT * FROM watchlater WHERE user_id = ? AND video_id = ?`;

    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.length > 0) {
            return res.status(200).json({ watchlater: true });
        } else {
            return res.status(200).json({ watchlater: false });
        }
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

app.get("/getfeed", (req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT feed FROM user where user_id= ?`;
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ feed: results });
    });
});

app.post("/updatefeed", (req, res) => {
    const user_id = req.body.user_id;
    const feed = req.body.feed;
    const query = `UPDATE user SET feed = ? WHERE user_id = ?`;

    connection.query(query, [feed, user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ message: "Feed updated successfully" });
    });
});

app.get("/get-subs", (req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT * FROM subscriptions s join channels c where s.channel_id=c.channel_id and s.user_id= ? order by sub_time desc`;

    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ subscription: results });
    });
});

function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`exec error: ${error.message}`));
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }

            resolve(stdout);
        });
    });
}

// const volumePath = process.env.VOLUME_PATH || "/root/ytdlp";
// const ytdlpPath = path.join(volumePath, "yt-dlp");

// if (!fs.existsSync(volumePath)) {
//     fs.mkdirSync(volumePath, { recursive: true });
// }

// // Configure storage to keep the original filename
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, volumePath);
//     },
//     filename: function (req, file, cb) {
//         cb(null, file.originalname);
//     },
// });

// app.post("/upload", upload.single("file"), (req, res) => {
//     if (!req.file) {
//         return res.status(400).send("No file uploaded.");
//     }

//     const file = req.file;
//     const filePath = path.join(volumePath, file.originalname);

//     res.status(200).send("File uploaded successfully.");
// });

app.get("/get-stream-url", async (req, res) => {
    const videoId = req.query.video_id;

    if (!videoId) {
        return res.status(400).send("Video ID is required");
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const command = `${ytdlpPath} -f b --get-url ${videoUrl}`;
    try {
        const streamUrl = await executeCommand(command);

        if (!streamUrl) {
            return res.status(500).send("Failed to fetch stream URL");
        }

        res.json({ streamUrl: streamUrl.trim() });
    } catch (error) {
        console.error(`Error fetching stream URL.`);
        res.status(500).send("An error occurred while fetching the stream URL");
    }
});

app.listen(port, () => console.log(`Server on port: ${port}`));
