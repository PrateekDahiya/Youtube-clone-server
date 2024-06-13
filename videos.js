const mysql = require("mysql2/promise");
const axios = require("axios");

const API_KEYS = [
    "AIzaSyD6RFir2BFyI4vZQZ_vLywajaMKdHEMrRM",
    // "AIzaSyCHVpv2IULIS6j-QvqB11lyMNhdLTFsNNQ",
    // "AIzaSyCHgYIVz_cneSBb1Omwn1ZYv0E0j8ao4F8",
    // "AIzaSyChx7jkzmO_7Aigv2FLyVEZZuJryCAeBtg",
];
let currentApiKeyIndex = 0;

const dbConfig = {
    host: "roundhouse.proxy.rlwy.net",
    user: "root",
    password: "WSctbyTrTVbTOwfSdDWKByZGOGsXHMFC",
    database: "youtube",
    port: 59156,
};

const categoryMapping = {
    1: "Film & Animation",
    2: "Autos & Vehicles",
    10: "Music",
    15: "Pets & Animals",
    17: "Sports",
    18: "Short Movies",
    19: "Travel & Events",
    20: "Gaming",
    21: "Videoblogging",
    22: "People & Blogs",
    23: "Comedy",
    24: "Entertainment",
    25: "News & Politics",
    26: "Howto & Style",
    27: "Education",
    28: "Science & Technology",
    29: "Nonprofits & Activism",
    30: "Movies",
    31: "Anime/Animation",
    32: "Action/Adventure",
    33: "Classics",
    34: "Comedy",
    35: "Documentary",
    36: "Drama",
    37: "Family",
    38: "Foreign",
    39: "Horror",
    40: "Sci-Fi/Fantasy",
    41: "Thriller",
    42: "Shorts",
    43: "Shows",
    44: "Trailers",
};

function getCategoryName(categoryId) {
    return categoryMapping[categoryId] || "Unknown";
}

// enhance channel icon

function convertImageUrl(oldUrl) {
    let newUrl = oldUrl.replace("yt3.ggpht.com", "yt3.googleusercontent.com");
    newUrl = newUrl.replace(/s\d+-c/, "s160-c");
    return newUrl;
}

// Helper function to convert ISO 8601 datetime to MySQL datetime format
const convertToMySQLDatetime = (isoDate) => {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    const hours = ("0" + date.getHours()).slice(-2);
    const minutes = ("0" + date.getMinutes()).slice(-2);
    const seconds = ("0" + date.getSeconds()).slice(-2);
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Helper function to convert ISO 8601 duration to seconds
const convertDurationToSeconds = (isoDuration) => {
    const matches = isoDuration.match(
        /P(?:([\d.]+)Y)?(?:([\d.]+)M)?(?:([\d.]+)D)?T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?/
    );
    const years = parseFloat(matches[1]) || 0;
    const months = parseFloat(matches[2]) || 0;
    const days = parseFloat(matches[3]) || 0;
    const hours = parseFloat(matches[4]) || 0;
    const minutes = parseFloat(matches[5]) || 0;
    const seconds = parseFloat(matches[6]) || 0;

    // Convert everything to seconds
    return (
        years * 365 * 24 * 60 * 60 +
        months * 30 * 24 * 60 * 60 +
        days * 24 * 60 * 60 +
        hours * 60 * 60 +
        minutes * 60 +
        seconds
    );
};

const fetchAndStoreVideos = async (
    channelId,
    totalResults,
    startingPageToken = null
) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        let nextPageToken = startingPageToken;
        let fetchedResults = 0;

        const apiKey = API_KEYS[currentApiKeyIndex];
        currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;

        // Fetch channel details (including the icon)
        const channelResponse = await axios.get(
            "https://www.googleapis.com/youtube/v3/channels",
            {
                params: {
                    key: apiKey,
                    id: channelId,
                    part: "snippet,statistics,brandingSettings",
                },
            }
        );

        if (
            !channelResponse.data.items ||
            channelResponse.data.items.length === 0
        ) {
            throw new Error("Channel not found.");
        }

        const channel = channelResponse.data.items[0];
        const snippet = channel.snippet;
        const statistics = channel.statistics;
        const brandingSettings = channel.brandingSettings;

        // Extract channel details
        const channelDetails = {
            id: channel.id,
            name: snippet.title,
            description: snippet.description || "N/A",
            dateCreated: convertToMySQLDatetime(snippet.publishedAt),
            location: snippet.country || "N/A",
            subscribers: statistics.subscriberCount || 0,
            icon: convertImageUrl(snippet.thumbnails.high.url), // Assuming the channel icon is in default thumbnail
            banner: brandingSettings.image
                ? brandingSettings.image.bannerExternalUrl +
                  "=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj"
                : "N/A",
            videoCount: statistics.videoCount || 0,
            totalViews: statistics.viewCount || 0,
            customUrl: snippet.customUrl || "N/A", // Assuming the channel icon is in default thumbnail
            keywords:
                (brandingSettings &&
                    brandingSettings.channel &&
                    brandingSettings.channel.keywords) ||
                "N/A",
        };

        // Store channel details in the database
        await connection.execute(
            `INSERT INTO channels (channel_id, channel_name, subscribers, date_created, short_desc, location, channel_icon, channel_banner, video_count, total_views, custom_url,keywords)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
             ON DUPLICATE KEY UPDATE channel_name = VALUES(channel_name), subscribers = VALUES(subscribers), date_created = VALUES(date_created), short_desc = VALUES(short_desc), location = VALUES(location), channel_icon = VALUES(channel_icon), channel_banner = VALUES(channel_banner), video_count = VALUES(video_count), total_views = VALUES(total_views), custom_url = VALUES(custom_url), keywords = VALUES(keywords)`,
            [
                channelDetails.id,
                channelDetails.name,
                channelDetails.subscribers,
                channelDetails.dateCreated,
                channelDetails.description,
                channelDetails.location,
                channelDetails.icon,
                channelDetails.banner,
                channelDetails.videoCount,
                channelDetails.totalViews,
                channelDetails.customUrl,
                channelDetails.keywords,
            ]
        );

        // Fetch video details for each page
        while (fetchedResults < totalResults) {
            const remainingResults = totalResults - fetchedResults;
            const maxResults = remainingResults > 50 ? 50 : remainingResults;

            try {
                const searchResponse = await axios.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    {
                        params: {
                            key: apiKey,
                            channelId: channelId,
                            part: "snippet",
                            order: "date",
                            maxResults: maxResults,
                            pageToken: nextPageToken,
                        },
                    }
                );

                const videoIds = searchResponse.data.items
                    .map((item) => item.id.videoId)
                    .filter((videoId) => videoId);

                if (videoIds.length === 0) {
                    break;
                }

                const videoStatsResponse = await axios.get(
                    "https://www.googleapis.com/youtube/v3/videos",
                    {
                        params: {
                            key: apiKey,
                            id: videoIds.join(","),
                            part: "snippet,statistics,contentDetails",
                        },
                    }
                );

                const videos = videoStatsResponse.data.items.map((item) => {
                    const duration = convertDurationToSeconds(
                        item.contentDetails.duration
                    );
                    const isShort = duration <= 61;
                    return {
                        videoId: item.id,
                        title: item.snippet.title || "N/A",
                        description: item.snippet.description || "N/A",
                        thumbnail: item.snippet.thumbnails.high.url || "N/A",
                        uploadTime: convertToMySQLDatetime(
                            item.snippet.publishedAt
                        ),
                        views: item.statistics.viewCount || 0,
                        likes: item.statistics.likeCount || 0,
                        dislikes: item.statistics.dislikeCount || 0,
                        link: `https://www.youtube.com/watch?v=${item.id}`,
                        duration: convertDurationToSeconds(
                            item.contentDetails.duration
                        ),
                        channelId: item.snippet.channelId,
                        tags: item.snippet.tags
                            ? item.snippet.tags.join(", ")
                            : "",
                        category:
                            getCategoryName(item.snippet.categoryId) || "N/A",
                        isShort: isShort,
                    };
                });

                // Store video details in the database
                const videoPromises = videos.map((video) => {
                    return connection.execute(
                        `INSERT INTO videos (video_id, title, views, likes, dislikes, link, upload_time, channel_id, thumbnail_link, video_description, duration, tags, category, isShort)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE title = VALUES(title), views = VALUES(views), likes = VALUES(likes), dislikes = VALUES(dislikes), link = VALUES(link), upload_time = VALUES(upload_time), thumbnail_link = VALUES(thumbnail_link), video_description = VALUES(video_description), duration = VALUES(duration), tags = VALUES(tags), category = VALUES(category), isShort =VALUES(isShort)`,
                        [
                            video.videoId,
                            video.title,
                            video.views,
                            video.likes,
                            video.dislikes,
                            video.link,
                            video.uploadTime,
                            video.channelId,
                            video.thumbnail,
                            video.description,
                            video.duration,
                            video.tags,
                            video.category,
                            video.isShort,
                        ]
                    );
                });

                await Promise.all(videoPromises);
                fetchedResults += videos.length;
                nextPageToken = searchResponse.data.nextPageToken;

                if (!nextPageToken) {
                    break;
                }
            } catch (searchError) {
                if (searchError.response) {
                    console.error(
                        "Error during search API request:",
                        searchError.response.data
                    );
                } else {
                    console.error(
                        "Error during search API request:",
                        searchError.message
                    );
                }
                console.error("Request params:", {
                    key: apiKey,
                    channelId: channelId,
                    part: "snippet",
                    order: "date",
                    maxResults: maxResults,
                    pageToken: nextPageToken,
                });
                break;
            }
        }

        await connection.end();
        console.log(
            `Fetched and stored ${fetchedResults} videos from channel ${channelId} last token: ${nextPageToken}`
        );
    } catch (error) {
        if (error.response) {
            console.error(
                "Error fetching and storing videos:",
                error.response.data
            );
        } else {
            console.error("Error fetching and storing videos:", error.message);
        }
        throw error;
    }
};

const channelId = "UCRXiA3h1no_PFkb1JCP0yMA";
const totalResults = 100;
const startingPageToken = null;
fetchAndStoreVideos(channelId, totalResults, startingPageToken)
    .then(() => console.log("Videos stored successfully."))
    .catch((error) => console.error("Error:", error.message));

// npm install uuid
// const { v4: uuidv4 } = require("uuid");

// // Function to generate a base64 encoded UUID
// function generateBase64Uuid() {
//     // Generate a UUID
//     const uuid = uuidv4();
//     // Remove hyphens from the UUID
//     const uuidWithoutHyphens = uuid.replace(/-/g, "");
//     // Convert the UUID to a Buffer
//     const buffer = Buffer.from(uuidWithoutHyphens, "hex");
//     // Encode the Buffer to base64
//     const base64Id = buffer.toString("base64");
//     // Replace '+' with '-' and '/' with '_', and remove '==' padding
//     const urlSafeBase64Id = base64Id
//         .replace(/\+/g, "-")
//         .replace(/\//g, "_")
//         .replace(/=+$/, "");
//     return urlSafeBase64Id;
// }

// // Function to generate a channel ID
// function generateChannelId() {
//     const base64Id = generateBase64Uuid();
//     return `UC${base64Id}`;
// }

// // Function to generate a video ID
// function generateVideoId() {
//     // Generate a shorter UUID (using only the first 6 bytes)
//     const uuid = uuidv4().replace(/-/g, "").substring(0, 12);
//     // Convert the short UUID to a Buffer
//     const buffer = Buffer.from(uuid, "hex");
//     // Encode the Buffer to base64
//     const base64Id = buffer.toString("base64");
//     // Replace '+' with '-' and '/' with '_', and remove '==' padding
//     const urlSafeBase64Id = base64Id
//         .replace(/\+/g, "-")
//         .replace(/\//g, "_")
//         .replace(/=+$/, "");
//     return urlSafeBase64Id;
// }

// // Generate a channel ID
// const channelId = generateChannelId();
// console.log("Channel ID:", channelId);

// // Generate a video ID
// const videoId = generateVideoId();
// console.log("Video ID:", videoId);
