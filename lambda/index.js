'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
    signatureVersion: 'v4',
});
const Sharp = require('sharp');

const BUCKET = process.env.BUCKET;
const URL = process.env.URL;

exports.handler = function (event, context, callback) {
    const key = event.queryStringParameters.key;
    const match = key.match(/(\d+)x(\d+)x(\d+)\/(.*)/);
    let width = parseInt(match[1], 10);
    let height = parseInt(match[2], 10);
    const quality = parseInt(match[3], 10);
    const originalKey = match[4];

    if (height === 0) {
        height = 4096;
    }

    if (width === 0) {
        width = 4096;
    }

    console.log(key, originalKey, width, height, quality, match);

    S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
        .then(data => Sharp(data.Body)
            .resize(width, height)
            .max()
            .toFormat('jpeg', {'quality': quality})
            .toBuffer()
        )
        .then(buffer => S3.putObject({
                Body: buffer,
                Bucket: BUCKET,
                CacheControl: "max-age=94608000",
                ContentType: 'image/jpeg',
                Tagging: "resized=true",
                Key: key,
            }).promise()
        )
        .then(() => callback(null, {
                statusCode: '301',
                headers: {
                    'location': `${URL}/${key}`,
                    'Access-Control-Allow-Origin': '*',
                    'access-control-allow-methods': 'GET',
                    'access-control-max-age': '3000'
                },
                body: '',
            })
        )
        .catch(err => callback(err))
};
