$f = 'C:\Users\INDRA\Pictures\LALAPAN\web lalapan\bey-attend\src\components\RefereeArena.jsx'
$lines = Get-Content $f
$filtered = $lines | Where-Object { $_ -ne '      )}' }
Set-Content $f $filtered
