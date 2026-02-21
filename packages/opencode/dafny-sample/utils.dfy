// Utility functions - uses include for types
include "types.dfy"

module Utils {
  import opened Types
  
  function Max(a: int, b: int): int
  {
    if a > b then a else b
  }
  
  function Min(a: int, b: int): int
  {
    if a < b then a else b
  }
  
  // Passing lemma
  lemma MaxIsGE(a: int, b: int)
    ensures Max(a, b) >= a
    ensures Max(a, b) >= b
  {
    // Proof by definition
  }
  
  method SafeDivide(numerator: int, denominator: int) returns (result: int)
    requires denominator != 0
    ensures result == numerator / denominator
  {
    return numerator / denominator;
  }
}
