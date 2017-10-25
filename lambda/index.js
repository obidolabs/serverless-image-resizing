'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
    signatureVersion: 'v4',
});
const Sharp = require('sharp');
const pngquant = require('node-pngquant-native');

const BUCKET = process.env.BUCKET;
const URL = process.env.URL;

exports.handler = function (event, context, callback) {
    const key = event.queryStringParameters.key;
    const match = key.match(/(\d+)x(\d+)x(\d+|png)\/(.*)/);

    if (match.length !== 5) {
        callback(null, {
            statusCode: '404',
            headers: {
                'Access-Control-Allow-Origin': '*',
                'access-control-allow-methods': 'GET',
                'access-control-max-age': '3000'
            },
            body: '',
        });

        return;
    }

    let width = parseInt(match[1], 10);
    let height = parseInt(match[2], 10);
    let quality = match[3];
    const originalKey = match[4];

    if (quality !== "png") {
        quality = parseInt(quality, 10);
    }

    if (height === 0) {
        height = 4096;
    }

    if (width === 0) {
        width = 4096;
    }

    let format = 'jpeg';
    let options = {'quality': quality};

    if (quality === 'png') {
        format = 'png';
        options = {};
    }

    S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
        .then(function (data) {
                let pipe = Sharp(data.Body)
                    .resize(width, height)
                    .max();

                if (format === 'jpeg') {
                    pipe
                        .background({r: 255, g: 255, b: 255, alpha: 1})
                        .flatten();
                }

                return pipe
                    .toFormat(format, options)
                    .toBuffer();
            }
        )
        .then(function (buffer) {
                let newBuffer = buffer;

                if (format === 'png') {
                    newBuffer = pngquant.compress(buffer, {
                        quality: [60, 80]
                    });
                }

                return S3.putObject({
                    Body: newBuffer,
                    Bucket: BUCKET,
                    CacheControl: "max-age=94608000",
                    ContentType: 'image/' + format,
                    Tagging: "resized=true",
                    Key: key,
                }).promise()
            }
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
        .catch(err => {
            console.log({
                key: originalKey,
                url: URL,
                err: err
            });

            callback(null, {
                statusCode: '404',
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'access-control-allow-methods': 'GET',
                    'access-control-max-age': '3000'
                },
                body: '',
            })
        })
};
