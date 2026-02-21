<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a user attempts to register for a championship they are already
 * actively enrolled in.  Raised inside the registration DB::transaction() so
 * that the transaction rolls back atomically before the HTTP response is sent.
 */
class AlreadyRegisteredException extends RuntimeException {}
