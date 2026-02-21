<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a registration attempt finds the championship at maximum capacity
 * after acquiring the row-level lock inside the DB::transaction().
 */
class ChampionshipFullException extends RuntimeException {}
