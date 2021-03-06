<?php declare(strict_types = 1);

use Aerys\Host;
use Amp\Redis\Client;
use Auryn\Injector;
use ekinhbayar\GitAmp\Github\Credentials;
use ekinhbayar\GitAmp\Storage\Counter;
use ekinhbayar\GitAmp\Storage\RedisCounter;
use ekinhbayar\GitAmp\Websocket\Handler;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use Psr\Log\LoggerInterface;
use function Aerys\root;
use function Aerys\router;
use function Aerys\websocket;

//require_once __DIR__ . '/vendor/autoload.php';

$configuration = require_once __DIR__ . '/config.php';

$injector = new Injector;

$injector->alias(Counter::class, RedisCounter::class);

$injector->alias(Credentials::class, get_class($configuration['github']));

$injector->share($configuration['github']);

$injector->alias(LoggerInterface::class, Logger::class);
$injector->share(Logger::class);

$injector->delegate(Logger::class, function() use ($configuration) {
    $logger = new Logger('gitamp');

    $logger->pushHandler(new StreamHandler('php://stdout', $configuration['logLevel']));

    return $logger;
});

// @todo unuglify this
if (isset($configuration['ssl'])) {
    $origin = 'https://' . $configuration['hostname'];

    if ($configuration['ssl']['port'] !== 443) {
        $origin .= ':' . $configuration['ssl']['port'];
    }
} else {
    $origin = 'http://' . $configuration['hostname'];

    if ($configuration['expose']['port'] !== 80) {
        $origin .= ':' . $configuration['expose']['port'];
    }
}

$injector->define(Handler::class, [
    ':origin' => $origin,
]);

$injector->define(Client::class, [
    ':uri' => $configuration['redis']
]);

$websocket = $injector->make(Handler::class);

$router = router()->get('/ws', websocket($websocket));

$requestLogger = new class implements \Aerys\Bootable {
    private $logger;

    public function boot(\Aerys\Server $server, \Psr\Log\LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    public function __invoke(\Aerys\Request $req, \Aerys\Response $res)
    {
        $this->logger->debug('Incoming request', [
            'method'     => $req->getMethod(),
            'uri'        => $req->getUri(),
            'headers'    => $req->getAllHeaders(),
            'parameters' => $req->getAllParams(),
            'body'       => $req->getBody(),
        ]);
    }
};

if (isset($configuration['ssl'])) {
    (new Host())
        ->name($configuration['hostname'])
        ->expose($configuration['expose']['ip'], $configuration['expose']['port'])
        ->use($requestLogger)
        ->redirect('https://' . $configuration['hostname'])
    ;

    (new Host())
        ->name($configuration['hostname'])
        ->expose($configuration['ssl']['ip'], $configuration['ssl']['port'])
        ->encrypt($configuration['ssl']['certificate'], $configuration['ssl']['key'])
        ->use($requestLogger)
        ->use($router)
        ->use(root(__DIR__ . '/public'))
    ;
} else {
    (new Host())
        ->name($configuration['hostname'])
        ->expose($configuration['expose']['ip'], $configuration['expose']['port'])
        ->use($requestLogger)
        ->use($router)
        ->use(root(__DIR__ . '/public'))
    ;
}

$logger = $injector->make(LoggerInterface::class);

\Amp\onError(function(Throwable $e) use ($logger) {
    $logger->emergency('GitAmp blew up', ['exception' => $e]);
});
