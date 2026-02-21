// Math module - uses import for utils and include for types
include "types.dfy"

module Math {
  import opened Types

  function Sum(n: int): int
    requires n >= 0
  {
    if n == 0 then 0 else n + Sum(n - 1)
  }

  function Sum2(n: int): int
    requires n >= 0
  {
    if n == 0 then 0 else n + Sum(n - 1)
  }

  // Passing lemma - sum formula
  lemma SumFormula(n: int)
    requires n >= 0
    ensures Sum(n) == n * (n + 1) / 2
  {
    // Proof by induction
    if n == 0 {
      // Base case: Sum(0) == 0 == 0 * 1 / 2
    } else {
      // Inductive case
      SumFormula(n - 1);
      // Sum(n) = n + Sum(n-1) = n + (n-1)*n/2 = n*(n+1)/2
    }
  }

  // Another passing lemma
  lemma EvenPlusEvenIsEven(x: int, y: int)
    requires IsEven(x) && IsEven(y)
    ensures IsEven(x + y)
  {
    // Proof: if x = 2k and y = 2m, then x + y = 2(k + m)
  }
}
