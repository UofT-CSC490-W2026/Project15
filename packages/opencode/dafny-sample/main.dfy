// Main module - imports others and has a failing proof
include "types.dfy"
include "utils.dfy"
include "math.dfy"

module Main {
  import opened Types
  import opened Utils
  import Math
  
  method ComputeMax(a: int, b: int) returns (m: int)
    ensures m >= a && m >= b
    ensures m == a || m == b
  {
    m := Max(a, b);
    MaxIsGE(a, b);
  }
  
  // This lemma PASSES
  lemma PositiveSum(x: int, y: int)
    requires IsPositive(x) && IsPositive(y)
    ensures IsPositive(x + y // introduce a syntax error
  {
    // Proof by arithmetic
  }
  
  // This lemma PASSES - fixed
  lemma IncorrectLemma(x: int, y: int)
    requires x > 0 && y > 0
    ensures x + y > 0  // Correct: sum of positive numbers is positive
  {
    // Proof by arithmetic - Dafny verifies automatically
  }
  
  method Main()
  {
    var m := ComputeMax(10, 20);
    assert m == 20;
    
    Math.SumFormula(5);
  }
}
