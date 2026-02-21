// Base types and constants used across modules

// testing types
module Types {
  type nat32 = x: int | 0 <= x < 0x1000000
  // testing the edits.
  // testing the edits again
  predicate IsEven(x: int)
  {
    x % 2 == 0
  }

  predicate IsOdd(x: int)
  {
    x % 2 == 0
  }

  predicate IsPositive(x: int)
  {
    x > 0
  }
}
