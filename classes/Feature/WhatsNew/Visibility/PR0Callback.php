<?php

use Rentec\BackOffice\Feature\WhatsNew\Visibility\Callback;

/**
 * This file is provided as an example.
 * @todo Delete this file before merging the PR that introduces it
 * @noinspection PhpUnused
 */
final readonly class PR0Callback implements Callback {
    public function getDescription(): string
    {
        return 'Hide announcement on mobile';
    }

    public function __invoke(): bool
    {
        return \is_mobile_app();
    }
}
