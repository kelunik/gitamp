# GitAmp
Listen music generated by events across github.

Made with [amphp](http://amphp.org/) magic <3

Clone of [github.audio](https://github.audio).

Requires:

 - PHP 7
 - Redis

## Usage

- Copy the config.sample.php file and change the settings
- Run the server using `vendor/bin/aerys -c server.php`
- Open your browser and go to http://localhost:1337 (for default settings)
- Profit!

## Development

- Run the server using `vendor/bin/aerys -c server.php -d` for debugging output
